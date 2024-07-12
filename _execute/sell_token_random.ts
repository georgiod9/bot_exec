import { decrypt, getCoinData, createTransaction, sendAndConfirmTransactionWrapper, sendTransactionWrapper, bufferFromUInt64, getKeyPairFromPrivateKey, TransactionMode, getSPLBalance, calculateTokenPriceInSol, getSolBal } from "../utils"
import { Connection, PublicKey, Transaction, TransactionInstruction } from '@solana/web3.js';
import { getAssociatedTokenAddress, createAssociatedTokenAccountInstruction, TOKEN_PROGRAM_ID } from '@solana/spl-token';
import { RPC_TX, GLOBAL, FEE_RECIPIENT, SYSTEM_PROGRAM_ID, PUMP_FUN_ACCOUNT, PUMP_FUN_PROGRAM, ASSOC_TOKEN_ACC_PROG, PRIORITY_FEE } from '../config';
import { LOW_BALANCE_THRESHOLD } from "../main";
import { buyTokenRandom } from "./buy_token_random";
import { withdrawOne } from "./withdraw_one";


export async function sellTokenRandom(skcrypted: string, token: string, initialBalance: number, orderId: number, isReplenish?: boolean) {
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

        const tknBal = await getSPLBalance(token, owner.toString()) // Balance in uiAmount
        const tokenPrice = calculateTokenPriceInSol(coinData["virtual_sol_reserves"], coinData["virtual_token_reserves"]);

        if (tknBal == 0) {
            console.log('> Token balance is 0, a past buy transaction have probably failed.')
        }
        else if (tknBal * tokenPrice < initialBalance * LOW_BALANCE_THRESHOLD) {
            console.log(`[${payer.publicKey}] Token balance is less than allowed threshold. Buying the token instead.`)
            const tokenBalance = await getSPLBalance(token, owner.toString()) // Balance in uiAmount
            if (tokenBalance > 0) {
                if (isReplenish) {
                    const solBalance = await getSolBal(owner.toString())
                    console.log(`[${payer.publicKey}] Bot SOL and Token balance lower than threshold. Sol: ${solBalance} Token balance: ${tokenBalance}`)
                    console.log(`[${payer.publicKey}] ${tknBal * tokenPrice} !< ${initialBalance * LOW_BALANCE_THRESHOLD}`)
                    console.log(`[${payer.publicKey}] Stopping bot for wallet.`)
                    console.log(`----------------------------------------------`);

                    // WITHDRAW LOGIC FOR THIS WALLET
                    await withdrawOne(orderId, payer.publicKey.toString());
                    return;
                }
                console.log(`[${payer.publicKey}] Available token balance:`, tokenBalance);
                await buyTokenRandom(skcrypted, token, initialBalance, orderId, true);
            }
            return;
        }
        console.log(`Retrieved token balance for account ${payer.publicKey}: `, tknBal)
        // const tokenBalanceInt = Math.round(tknBal * 1000000)
        // const minValue = tknBal * 1000
        // const maxValue = tknBal * 1000000
        const minValue = tknBal * 0.2;
        const maxValue = tknBal * 0.8;
        const tokenBalanceRandom = Math.random() * (maxValue - minValue) + minValue
        const tokenBalanceInt = Math.round(tokenBalanceRandom * 1e6) // Convert to integer units
        const tokenBalance = tokenBalanceInt
        console.log(`Token amount to sell (random) for ${payer.publicKey}: `, tokenBalance)

        const tokenAccountAddress = await getAssociatedTokenAddress(mint, owner, false)

        const tokenAccountInfo = await connection.getAccountInfo(tokenAccountAddress)

        let tokenAccount: PublicKey
        if (!tokenAccountInfo) {
            txBuilder.add(
                createAssociatedTokenAccountInstruction(
                    payer.publicKey,
                    tokenAccountAddress,
                    payer.publicKey,
                    mint
                )
            )
            tokenAccount = tokenAccountAddress
        } else tokenAccount = tokenAccountAddress

        const minSolOutput = Math.floor(tokenBalance! * (1 - slippageDecimal) * coinData["virtual_sol_reserves"] / coinData["virtual_token_reserves"])

        console.log(`Token mininum Solana tokens out: `, minSolOutput);
        const keys = [
            { pubkey: GLOBAL, isSigner: false, isWritable: false },
            { pubkey: FEE_RECIPIENT, isSigner: false, isWritable: true },
            { pubkey: mint, isSigner: false, isWritable: false },
            { pubkey: new PublicKey(coinData['bonding_curve']), isSigner: false, isWritable: true },
            { pubkey: new PublicKey(coinData['associated_bonding_curve']), isSigner: false, isWritable: true },
            { pubkey: tokenAccount, isSigner: false, isWritable: true },
            { pubkey: owner, isSigner: false, isWritable: true },
            { pubkey: SYSTEM_PROGRAM_ID, isSigner: false, isWritable: false },
            { pubkey: ASSOC_TOKEN_ACC_PROG, isSigner: false, isWritable: false },
            { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
            { pubkey: PUMP_FUN_ACCOUNT, isSigner: false, isWritable: false },
            { pubkey: PUMP_FUN_PROGRAM, isSigner: false, isWritable: false }
        ];

        const data = Buffer.concat([
            bufferFromUInt64("12502976635542562355"),
            bufferFromUInt64(tokenBalance),
            bufferFromUInt64(minSolOutput)
        ]);

        const instruction = new TransactionInstruction({
            keys: keys,
            programId: PUMP_FUN_PROGRAM,
            data: data
        })

        txBuilder.add(instruction)

        const transaction = await createTransaction(connection, txBuilder.instructions, payer.publicKey, priorityFeeInSol)

        if (transactionMode == TransactionMode.Execution) {
            console.log('> Initiating sell token random...')
            //const signature = await sendTransactionWrapper(transaction, [payer])

            // REMOVE THE AWAIT HERE IF YOU DONT WANT TO WAIT THE CONFIRMATION
            // const signature = await sendAndConfirmTransactionWrapper(connection, transaction, [payer])
            const signature = sendAndConfirmTransactionWrapper(connection, transaction, [payer])
            console.log('> Sell transaction confirmed:', signature)
        }
        else if (transactionMode == TransactionMode.Simulation) {
            const simulatedResult = await connection.simulateTransaction(transaction)
            console.log(simulatedResult)
        }
    }
    catch (e) {
        console.log(e)
    }
}
