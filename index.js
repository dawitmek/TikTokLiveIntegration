const { WebcastPushConnection } = require('tiktok-live-connector');
const { MongoClient } = require('mongodb')

require('dotenv').config();

const MDB_PASSWORD = process.env.DBPASSWORD;

// Username of someone who is currently live
let tiktokUsername = "example123";

const uri = `mongodb+srv://admin:${MDB_PASSWORD}@cluster0.krlqmgt.mongodb.net/?retryWrites=true&w=majority`;
const db_client = new MongoClient(uri);
let currTime;

// ********************************  DATABASE *******************************************

async function initialConnect() {
    try {
        let connected = await db_client.connect()
        connected ? console.log('Connected to database.') : console.error('Connection to database failed.');
    } catch (err) {
        console.error('error: ', err)
    }
}

async function checkUserAndUpdate(id, comment, date) {
    try {
        let find = await db_client.db('base_score').collection(tiktokUsername).findOne(
            { id: id }
        )
        // checks if id is in collection or if was updated
        if (find) {
            let newComment = { comment: comment, date: date };
            let updated = await db_client.db('base_score').collection(tiktokUsername).updateOne(
                { id: id },
                {
                    $inc: { score: 1 },
                    $push: { comments: newComment }
                }
            )
            return true
        } else {
            return false
        }

    } catch (err) {
        console.error('Checking user error: ', err)
        return false;
    }
}

async function logComment(id, profileImgUrl, comment, date) {
    try {
        await db_client.db('base_score').collection(tiktokUsername).insertOne({
            id: id,
            profileImgUrl: profileImgUrl,
            comments: [
                {
                    comment: comment,
                    date: date
                }
            ],
            score: 1
        })
    } catch (err) {
        console.error('Adding comment error: ', err)

    }
}

// **************************  TIKTOK  *************************************************
let tiktok_client = new WebcastPushConnection(tiktokUsername);

tiktok_client.connect().then(state => {
    console.log(`Connected to ${state.roomId}`);
    initialConnect()
        .catch(console.error)
    currTime = Date.now();
})

tiktok_client.on('chat', (data => {
    try {
        comment(data.uniqueId, data.profilePictureUrl, data.comment, new Date(Date.now()).toLocaleString());
    } catch (error) {
        console.error('Chatting error: ', error);
    }
}))

tiktok_client.on('disconnected', () => {
    setTimeout(() => {
        tiktok_client.connect();
    }, 2000); 
})

tiktok_client.on('streamEnd', () => {
    db_client.close();
    console.log('Stream and Database connection closed');
})

tiktok_client.on('error', err => {
    db_client.close();
    console.error('Tiktok error: ', err);
})


async function comment(id, pictureUrl, comment, date) {
    // Returns true if user is found
    if (!(await checkUserAndUpdate(id, comment, date))) {
        // Added a comment
        await logComment(id, pictureUrl, comment, date); // creates query on user
    }
}

// ***************************************************************************

let interval = setInterval(() => {
    if (currTime + 2000 <= Date.now()) {
         db_client.close();
        console.log('Database connection closed');
        clearInterval(interval);
    }
}, 1000);

