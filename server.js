// It is important to config env at top of file and ASAP
// It only needs to require and config once, so I won't save to a variable
require("dotenv").config();
const express = require("express");
const _ = require("lodash");
var cors = require('cors');
const { Mongoose } = require("mongoose");
const app = express();
const mongoose = require("mongoose");
//* Hashing (Level #3)
var md5 = require("md5");
const { method } = require("lodash");


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
    const password = md5(req.body.password);
    
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
    const password = md5(req.body.password);
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






//! IMPORTANT NOTES: 

// 1.) Install md5 with npm and then require into the appropriate module
// 2.) When creating a user, make sure to hash the users password before storing (using md5() method)
// 3.) When logging in already enrolled users, make sure to hash the users password again in order to that to the previosly hashed password that is stored in the database already
