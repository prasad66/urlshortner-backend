const mongoose = require("mongoose");
const schema = mongoose.Schema;

const dbConnect = async () => {
    try {
        await mongoose.connect(
            process.env.DB_URL,
            {
                useNewUrlParser: true,
                useUnifiedTopology: true,
                autoIndex: true,
            }
        );
        console.log("DB Connected");
    } catch (e) {
        console.log(e.message, "error in connecting db");
    }
};
const userSchema = schema({
    firstName: {
        type: String,
    },
    lastName: {
        type: String,
    },
    email: {
        type: String,
        required: true,
        unique: true,
    },
    password: {
        type: String,
        required: true,
    },
    mobile:{
        type:String,
    },
    accountActive: {
        type: Boolean,
    },
    activateString: {
        type: String,
    },
    verifyString: {
        type: String,
    },
});
const urlSchema = schema({
    email: {
        type: String,
        required: true,
    },
    url: {
        type: String,
        required: true,
        // unique: true,
    },
    customUrl: {
        type: String,
        required: true,
        unique: true,
    },
    shortUrl:{
        type: String,
        required: true,
        unique: true,
    },
    clicks: {
        type: Number,
        required: true,
        default:0
    },
    createdAt: {
        type: Date,
        required: true,
    }
});

const user = mongoose.model("user", userSchema, "user");
const urlDB = mongoose.model("urlDB", urlSchema, "urls");

module.exports = { dbConnect, user, urlDB };
