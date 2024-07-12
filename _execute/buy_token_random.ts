import { getSPLBalance, decrypt, getCoinData, createTransaction, sendAndConfirmTransactionWrapper, sendTransactionWrapper, bufferFromUInt64, getKeyPairFromPrivateKey, TransactionMode, getSolBal } from "../utils"
import { Connection, LAMPORTS_PER_SOL, PublicKey, sendAndConfirmTransaction, Transaction, TransactionInstruction } from '@solana/web3.js';
import { getAssociatedTokenAddress, createAssociatedTokenAccountInstruction, TOKEN_PROGRAM_ID } from '@solana/spl-token';
import { RPC_TX, GLOBAL, FEE_RECIPIENT, SYSTEM_PROGRAM_ID, RENT, PUMP_FUN_ACCOUNT, PUMP_FUN_PROGRAM, ASSOC_TOKEN_ACC_PROG, PRIORITY_FEE } from '../config';
import { LOW_BALANCE_THRESHOLD, removeTasksForBot } from "../main";
import { sellTokenRandom } from "./sell_token_random";
import { withdrawOne } from "./withdraw_one";

export async function buyTokenRandom(skcrypted: string, token: string, initialBalance: number, orderId: number, isReplenish?: boolean) {
    try {

        const transactionMode = TransactionMode.Execution
        const priorityFeeInSol = PRIORITY_FEE
        const slippageDecimal = 0.25

        const connection = new Connection(RPC_TX, 'confirmed')
        const coinData = await getCoinData(token);
        if (!coinData) {
            console.error('> Failed to retrieve coin data...')
            return
        }
        const payerPrivateKey = await decrypt(skcrypted)
        const payer = await getKeyPairFromPrivateKey(payerPrivateKey)
        const owner = payer.publicKey
        const mint = new PublicKey(token)
        const txBuilder = new Transaction()
        const tokenAccountAddress = await getAssociatedTokenAddress(mint, owner, false)

        const solBal = await getSolBal(owner.toString())
        if (solBal == 0) {
            console.log('> Solana balance is 0.')
            return
        }
        else if (solBal < initialBalance * LOW_BALANCE_THRESHOLD) {
            console.log(`[${payer.publicKey}] Sol balance is less than allowed threshold. Selling token instead.`)
            const tokenBalance = await getSPLBalance(token, owner.toString()) // Balance in uiAmount
            if (tokenBalance > 0) {
                if (isReplenish) {
                    // const tokenBalance = await getSPLBalance(token, owner.toString());

                    console.log(`[${payer.publicKey}] Bot SOL and Token balance lower than threshold. Sol: ${solBal} Token balance: ${tokenBalance}`)
                    console.log(`[${payer.publicKey}] ${solBal} !< ${initialBalance * LOW_BALANCE_THRESHOLD}`)
                    console.log(`[${payer.publicKey}] Stopping bot for wallet.`)
                    console.log(`----------------------------------------------`);

                    console.log(`[${payer.publicKey}] Removing tasks for bot.`)
                    // Remove the redis tasks
                    await removeTasksForBot(orderId, skcrypted);

                    // WITHDRAW LOGIC FOR THIS WALLET
                    await withdrawOne(orderId, payer.publicKey.toString());

                    return;
                }
                console.log(`[${payer.publicKey}] Available token balance:`, tokenBalance);
                await sellTokenRandom(skcrypted, token, initialBalance, orderId, true);
            }
            return;
        }

        console.log(`Solana balance for address ${payer.publicKey}: `, solBal)
        const minValue = solBal * 0.1
        const maxValue = solBal * 0.5
        const solRandom = Math.random() * (maxValue - minValue) + minValue
        const solBalInt = Math.round(solRandom)
        const solIn = solBalInt / 1000000000

        // console.log(solIn)
        console.log(`Solana amount to buy with (random) for ${payer.publicKey}: `, solIn)

        const tokenAccountInfo = await connection.getAccountInfo(tokenAccountAddress)
        let tokenAccount: PublicKey
        if (!tokenAccountInfo) {
            txBuilder.add(createAssociatedTokenAccountInstruction(payer.publicKey, tokenAccountAddress, payer.publicKey, mint))
            tokenAccount = tokenAccountAddress
        } else tokenAccount = tokenAccountAddress

        const solInLamports = solIn * LAMPORTS_PER_SOL
        const tokenOut = Math.floor(solInLamports * coinData["virtual_token_reserves"] / coinData["virtual_sol_reserves"])

        const solInWithSlippage = solIn * (1 + slippageDecimal)
        const maxSolCost = Math.floor(solInWithSlippage * LAMPORTS_PER_SOL)
        const ASSOCIATED_USER = tokenAccount
        const USER = owner
        const BONDING_CURVE = new PublicKey(coinData['bonding_curve'])
        const ASSOCIATED_BONDING_CURVE = new PublicKey(coinData['associated_bonding_curve'])

        const keys = [
            { pubkey: GLOBAL, isSigner: false, isWritable: false },
            { pubkey: FEE_RECIPIENT, isSigner: false, isWritable: true },
            { pubkey: mint, isSigner: false, isWritable: false },
            { pubkey: BONDING_CURVE, isSigner: false, isWritable: true },
            { pubkey: ASSOCIATED_BONDING_CURVE, isSigner: false, isWritable: true },
            { pubkey: ASSOCIATED_USER, isSigner: false, isWritable: true },
            { pubkey: USER, isSigner: false, isWritable: true },
            { pubkey: SYSTEM_PROGRAM_ID, isSigner: false, isWritable: false },
            { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
            { pubkey: RENT, isSigner: false, isWritable: false },
            { pubkey: PUMP_FUN_ACCOUNT, isSigner: false, isWritable: false },
            { pubkey: PUMP_FUN_PROGRAM, isSigner: false, isWritable: false },
        ]

        const data = Buffer.concat([
            bufferFromUInt64("16927863322537952870"),
            bufferFromUInt64(tokenOut),
            bufferFromUInt64(maxSolCost)
        ])

        const instruction = new TransactionInstruction({
            keys: keys,
            programId: PUMP_FUN_PROGRAM,
            data: data
        })
        txBuilder.add(instruction)

        const transaction = await createTransaction(connection, txBuilder.instructions, payer.publicKey, priorityFeeInSol)
        if (transactionMode == TransactionMode.Execution) {
            console.log('> Initiating buy token random...')
            // const signature = await sendTransactionWrapper(transaction, [payer])

            // REMOVE THE AWAIT HERE IF YOU DONT WANT TO WAIT THE CONFIRMATION
            // const signature = await sendAndConfirmTransactionWrapper(connection, transaction, [payer])
            const signature = sendAndConfirmTransactionWrapper(connection, transaction, [payer])
            console.log('> Buy transaction confirmed:', signature)
        }
        else if (transactionMode == TransactionMode.Simulation) {
            const simulatedResult = await connection.simulateTransaction(transaction)
            console.log(simulatedResult)
        }
    } catch (e) {
        console.log(e)
    }
}
