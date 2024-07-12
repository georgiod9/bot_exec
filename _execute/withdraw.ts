import { getClientForOrderId, getTokenAddrForOrderId, getWalletPkForOrderId, getWalletSkForOrderId } from "../utils"
import { decrypt, getSolBal, getSPLBalance, sendSPL, sendSOL } from "../utils"

const balanceToStr = (balNbr: number) => {
    const balance = balNbr / (10 ** 9)
    const strBalance = balance.toLocaleString(undefined, { minimumFractionDigits: 6, maximumFractionDigits: 6 })
    const mainStrBalance = strBalance.replace(',', '.')
    return mainStrBalance;
};

export async function withdrawBot(walletSK: string, walletPK: string, clientPk: string, tokenAddr: string, botIndex: number) {

    try {
        const botDecryptedPrivateKey = await decrypt(walletSK)
        const tokenBal = await getSPLBalance(tokenAddr, walletPK)
        console.log('-------------------------------------------------------------')
        console.log(`> Bot #${botIndex} token balance = ${balanceToStr(tokenBal)}`);
        console.log('-------------------------------------------------------------')
        if (tokenBal > 0) {
            console.log(`> Sending ${tokenBal} token to client...`);
            const splTX = await sendSPL(walletPK, await decrypt(walletSK), clientPk, tokenAddr)
            if (splTX) {
                console.log('-------------------------------------------------------------')
                console.log(`"\u001b[1;32m" + 'SUCCESS ' + "\u001b[0m"` + `sending ${tokenBal} token from bot #${botIndex} to client`)
                console.log("\u001b[1;34m" + 'TX ' + "\u001b[0m" + splTX)
                console.log('-------------------------------------------------------------')
            } else {
                console.log('-------------------------------------------------------------')
                console.log(`"\u001b[1;31m" + 'ERROR ' + "\u001b[0m"` + `sending ${tokenBal} token from bot #${botIndex} to client`);
                console.log('-------------------------------------------------------------')
            }
        }
        const solBal = await getSolBal(walletPK)
        console.log('-------------------------------------------------------------')
        console.log(`> Bot #${botIndex} SOL balance = ${balanceToStr(solBal)}`);
        console.log('-------------------------------------------------------------')
        if (solBal > 0) {
            console.log(`> Sending ${solBal} SOL to client...`);
            const sendSolTx = await sendSOL(botDecryptedPrivateKey, solBal, clientPk)
            if (sendSolTx) {
                console.log('-------------------------------------------------------------')
                console.log("\u001b[1;32m" + 'SUCCESS ' + "\u001b[0m" + `sending back ${balanceToStr(solBal)} SOL from bot #${botIndex} to client`);
                console.log("\u001b[1;34m" + 'TX ' + "\u001b[0m" + sendSolTx)
                console.log('-------------------------------------------------------------')
            } else {
                console.log('-------------------------------------------------------------')
                console.log(`"\u001b[1;31m" + 'ERROR ' + "\u001b[0m"` + `sending back ${balanceToStr(solBal)} SOL from bot #${botIndex} to client`);
                console.log('-------------------------------------------------------------')
            }
        }

        return true;
    } catch (error) {
        console.error(`Error withdrawing for bot: ${botIndex}`, error);
        return false;
    }

}