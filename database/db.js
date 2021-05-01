const mongoose = require("mongoose");
const passportLocalMongoose = require("passport-local-mongoose");
const findOrCreate = require("mongoose-findorcreate");
const { userSchema } = require("./models");


// Connect to database, create schema, and encrypt password
mongoose.connect("mongodb://localhost:27017/userDB", {
    useNewUrlParser: true,
    useUnifiedTopology: true,
    useCreateIndex: true,
    //useFindAndModify: false, 
});

/*
1. Passport-Local Mongoose will add a username, hash and salt field to the schema (userSchema here)
2. The plugin must be used with a mongoose schema instance (not just a js object)
*/
userSchema.plugin(passportLocalMongoose);
userSchema.plugin(findOrCreate);

exports.User = new mongoose.model("User", userSchema);