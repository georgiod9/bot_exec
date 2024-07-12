import { setOrderLive, splitSol, buyToken, buyTokenRandom, sellTokenRandom, withdrawAll, setOrderFinished } from "./_execute";
import { REDIS_HOST, REDIS_PORT, REDIS_PASSWORD, MONGODB_URI } from "./config";
import Bull from "bull";
import Order from "./models/order";
import { connectDB, isMongoConnected } from "./utils";

const redisOptions = { redis: { host: REDIS_HOST, port: parseInt(REDIS_PORT, 10), password: REDIS_PASSWORD, keyPrefix: "{bump}:" } }
const bumpQueue = new Bull("bump", redisOptions)

async function clearQueue() {
    await bumpQueue.empty(); // Clears all the waiting jobs
    await bumpQueue.clean(0, 'delayed'); // Clears all the delayed jobs
    await bumpQueue.clean(0, 'failed'); // Clears all the failed jobs
    await bumpQueue.clean(0, 'completed'); // Clears all the completed jobs
    console.log('Queue cleared');
}

async function checkQueueLength() {
    const waitingCount = await bumpQueue.getWaitingCount();
    const activeCount = await bumpQueue.getActiveCount();
    const completedCount = await bumpQueue.getCompletedCount();
    const failedCount = await bumpQueue.getFailedCount();
    const delayedCount = await bumpQueue.getDelayedCount();

    console.log(`Waiting: ${waitingCount}, Active: ${activeCount}, Completed: ${completedCount}, Failed: ${failedCount}, Delayed: ${delayedCount}`);
}

async function removeTasksForOrderId(orderID: number) {
    let delay = 1000
    const alltasks = await bumpQueue.getJobs(["delayed", "active", "waiting", "completed"])
    const tasksok = alltasks.filter(task => task.data.orderId === `#${orderID.toString()}`)
    for (const task of tasksok) {
        await task.remove()
    }
    console.log("\u001b[1;32m" + 'SUCCESS ' + "\u001b[0m" + `removing ${tasksok.length} tasks for order ID #${orderID.toString()}`)
    console.log('-------------------------------------------------------------')
    console.log(`> Initiating emergency withdrawal for order #${orderID}...`)
    bumpQueue.add({ task: "withdraw", orderId: `#${orderID.toString()}`, param: orderID }, { delay })
    console.log('-------------------------------------------------------------')
    console.log("\u001b[1;32m" + 'SUCCESS ' + "\u001b[0m" + `withdrawal initiated for order ID #${orderID.toString()}`)
}

export async function removeTasksForBot(orderID: number, botEncryptedSK: string) {
    let delay = 1000
    const alltasks = await bumpQueue.getJobs(["delayed", "active", "waiting", "completed"])
    const tasksok = alltasks.filter(task => task.data.orderId === `#${orderID.toString()}`)
    const botTasks = tasksok.filter(task => task.data.skcrypted === botEncryptedSK);
    for (const task of botTasks) {
        await task.remove()
    }
    console.log("\u001b[1;32m" + 'SUCCESS ' + "\u001b[0m" + `removing ${tasksok.length} tasks for order ID #${orderID.toString()} Bot PubKey`)
    console.log('-------------------------------------------------------------')
    console.log(`> Initiating emergency withdrawal for order #${orderID}...`)
    bumpQueue.add({ task: "withdraw", orderId: `#${orderID.toString()}`, param: orderID }, { delay })
    console.log('-------------------------------------------------------------')
    console.log("\u001b[1;32m" + 'SUCCESS ' + "\u001b[0m" + `withdrawal initiated for order ID #${orderID.toString()}`)
}


export const LOW_BALANCE_THRESHOLD = 0.1; // 10% of initial balance

async function main() {
    // await clearQueue();
    await checkQueueLength();
    if (!isMongoConnected) {
        await connectDB();
    }

    console.log(`EXECUTOR RUNNING`)
    console.log('-------------------------------------------------------------')
    bumpQueue.process(async (order, done) => {
        console.log("> Processing ", order.data);
        try {
            if (order.data.task === 'set_order_status_live') {
                await setOrderLive(order.data.param)
            } else if (order.data.task === 'split') {
                await splitSol(order.data.param, order.data.funding)
            } else if (order.data.task === 'buy_token') {
                await buyToken(order.data.skcrypted, order.data.token, order.data.amountSol)
            } else if (order.data.task === 'buy_token_random') {
                await buyTokenRandom(order.data.skcrypted, order.data.token, order.data.initialBalance, order.data.param)
            } else if (order.data.task === 'sell_token_random') {
                await sellTokenRandom(order.data.skcrypted, order.data.token, order.data.initialBalance, order.data.param)
            } else if (order.data.task === 'withdraw') {
                await withdrawAll(order.data.param)
            } else if (order.data.task === 'set_order_status_finished') {
                await setOrderFinished(order.data.param)
            }
            done()
        } catch (e) {
            console.error('> Error processing ', e)
            done()
        }
    })
}
main().catch((e) => {
    console.log(e)
    main()
})