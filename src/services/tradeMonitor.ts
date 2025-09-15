import { ENV } from '../config/env';
import { UserActivityInterface } from '../interfaces/User';
import { getUserActivityModel } from '../models/userHistory';
import fetchData from '../utils/fetchData';

const USER_ADDRESS = ENV.USER_ADDRESS;
const TOO_OLD_TIMESTAMP = ENV.TOO_OLD_TIMESTAMP;
const FETCH_INTERVAL = ENV.FETCH_INTERVAL;

if (!USER_ADDRESS) {
    throw new Error('USER_ADDRESS is not defined');
}

const UserActivity = getUserActivityModel(USER_ADDRESS);


const fetchTradeData = async () => {
    try {
        console.log('Fetching trade data for user:', USER_ADDRESS);
        
        const activities: UserActivityInterface[] = await fetchData(
            `https://data-api.polymarket.com/activity?user=${USER_ADDRESS}&type=TRADE&limit=100&sortBy=TIMESTAMP&sortDirection=DESC`
        );
        
        if (!activities || activities.length === 0) {
            console.log('No activities found for user');
            return;
        }
        
        console.log(`Found ${activities.length} activities`);
        
        const currentTime = Math.floor(Date.now() / 1000);
        const cutoffTime = currentTime - (TOO_OLD_TIMESTAMP * 3600); // TOO_OLD_TIMESTAMP is in hours
        
        const recentActivities = activities.filter(activity => 
            activity.timestamp && activity.timestamp > cutoffTime
        );
        
        console.log(`${recentActivities.length} recent activities after filtering`);
        
        for (const activity of recentActivities) {
            const existingTrade = await UserActivity.findOne({
                transactionHash: activity.transactionHash,
                timestamp: activity.timestamp
            });
            
            if (!existingTrade) {
                const tradeData = {
                    ...activity,
                    bot: false,
                    botExcutedTime: 0
                };
                
                const newTrade = new UserActivity(tradeData);
                await newTrade.save();
                console.log('Saved new trade:', activity.transactionHash);
            }
        }
        
    } catch (error) {
        console.error('Error fetching trade data:', error);
    }
};

const tradeMonitor = async () => {
    console.log('Trade Monitor is running every', FETCH_INTERVAL, 'seconds');
    while (true) {
        await fetchTradeData();
        await new Promise((resolve) => setTimeout(resolve, FETCH_INTERVAL * 1000));
    }
};

export default tradeMonitor;
