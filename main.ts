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
                await buyTokenRandom(order.data.skcrypted, order.data.token)
            } else if (order.data.task === 'sell_token_random') {
                await sellTokenRandom(order.data.skcrypted, order.data.token)
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