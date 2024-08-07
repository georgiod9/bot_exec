import { connectDB, isMongoConnected } from "../utils";
import Order from '../models/order';

export async function setOrderFinished(orderID: number) {
    // await connectDB()
    if (!isMongoConnected) {
        await connectDB()
    }
    const ok = await Order.findOneAndUpdate({ id: orderID }, { $set: { status: 'finished' } }, { new: true })
    if (ok) {
        console.log("\u001b[1;32m" + '> SUCCESS ' + "\u001b[0m" + `order #${orderID} status updated to 'finished'`)
        console.log('-------------------------------------------------------------')
    } else {
        console.log("\u001b[1;31m" + '> ERROR ' + "\u001b[0m" + `modifying order #${orderID} status`)
        console.log('-------------------------------------------------------------')
    }
}