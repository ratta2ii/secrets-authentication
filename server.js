const express = require("express");
const _ = require("lodash");
var cors = require('cors');
const { Mongoose } = require("mongoose");
const app = express();
const mongoose = require("mongoose");
const encrypt = require("mongoose-encryption");

//! Express v4.16.0 and higher
// --------------------------
// (express is required in above already)
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cors());

//! For Express version less than 4.16.0
// ------------------------------------
// const bodyParser = require('body-parser');
// app.use(express.json());
// app.use(bodyParser.urlencoded({extended: true}));

//! Use for serving ejs pages or css, images, etc here in server
app.set('view engine', 'ejs');
app.use(express.static("public"));

//! Connect to database, create schema, and encrypt password
mongoose.connect("mongodb://localhost:27017/userDB", { useNewUrlParser: true });

const userSchema = new mongoose.Schema({
    email: String, 
    password: String
});

//* mongoose-encryption
const secret = "SomesecretImadeup.";
userSchema.plugin(encrypt, { secret: secret, encryptedFields: ["password"] });

const User = new mongoose.model("User", userSchema);

// !Routes
app.get("/", function(req, res) {
    res.render("home");
});

app.get("/login", function(req, res) {
    res.render("login");
});

app.get("/register", function(req, res) {
    res.render("register");
});

app.post("/register", function(req, res) {
    const email = req.body.username;
    const password = req.body.password;
    
    const newUser = new User({
        email: email,
        password: password
    });
    
    newUser.save(function(err) {
        if (!err) {
            res.render("secrets");
        } else {
            console.log(err);
        }
    });
})

app.post("/login", function(req, res) {
    const email = req.body.username;
    const password = req.body.password;
    User.findOne({ email: email }, function (err, foundUser) {
        if (err) {
            console.log(err);
        }
        else {
            if (foundUser) {
                if (foundUser.password === password) {
                    res.render("secrets");
                }
                else {
                    console.log("You have the wrong password!");
                }
           }
        } 
    });
});

//! Choose port and connect to server
let port = process.env.PORT;
if (port == null || port == "") {
    port = 5000;
}

app.listen(port, function () {
    console.log(`Server is running on PORT: ${port}`);
});
