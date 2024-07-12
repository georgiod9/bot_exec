import { getClientForOrderId, getTokenAddrForOrderId, getWalletPkForOrderId, getWalletSkForOrderId } from "../utils"
import { decrypt, getSolBal, getSPLBalance, sendSPL, sendSOL } from "../utils"
import { withdrawBot } from "./withdraw";

const balanceToStr = (balNbr: number) => {
    const balance = balNbr / (10 ** 9)
    const strBalance = balance.toLocaleString(undefined, { minimumFractionDigits: 6, maximumFractionDigits: 6 })
    const mainStrBalance = strBalance.replace(',', '.')
    return mainStrBalance;
};

export async function withdrawOne(orderId: number, botPublicKey: string) {
    console.log('-------------------------------------------------------------')
    console.log(`> Single withdrawal for ${orderId} bot wallet ${botPublicKey}`);
    console.log('-------------------------------------------------------------')
    const clientPk = await getClientForOrderId(orderId)
    const tokenAddr = await getTokenAddrForOrderId(orderId)
    const walletsPK = await getWalletPkForOrderId(orderId)
    const walletsSK = await getWalletSkForOrderId(orderId)
    if (clientPk && tokenAddr && walletsPK && walletsSK) {
        const targetWalletIndex = walletsPK.findIndex((pk) => pk === botPublicKey);
        console.log(`Target wallet's index: `, targetWalletIndex)
        const targetWalletSK = walletsSK[targetWalletIndex];
        const targetWalletPK = walletsPK[targetWalletIndex];
        console.log(`[${botPublicKey}] Withdrawing bot's balances...`)
        await withdrawBot(targetWalletSK, targetWalletPK, clientPk, tokenAddr, targetWalletIndex);
    }
}