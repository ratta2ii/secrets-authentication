// It is important to config env at top of file and ASAP
// It only needs to require and config once, so I won't save to a variable
require("dotenv").config();
const express = require("express");
const _ = require("lodash");
var cors = require('cors');
const { Mongoose } = require("mongoose");
const app = express();
const mongoose = require("mongoose");
const session = require("express-session");
const passport = require("passport");
const passportLocalMongoose = require("passport-local-mongoose");

// Express v4.16.0 and higher
// --------------------------
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cors());

// For Express version less than 4.16.0
// ------------------------------------
// const bodyParser = require('body-parser');
// app.use(express.json());
// app.use(bodyParser.urlencoded({extended: true}));

// Use for serving ejs pages or css, images, etc here in server
app.set('view engine', 'ejs');
app.use(express.static("public"));

// Cookies and Sessions (express-session)
app.use(session({
  secret: "Our little secret.",
  resave: false,
  saveUninitialized: false
}));

// (passport)
app.use(passport.initialize());
app.use(passport.session());

// Choose port and connect to server
let port = process.env.PORT;
if (port == null || port == "") {
    port = 5000;
}

app.listen(port, function () {
    console.log(`Server is running on PORT: ${port}`);
});

// Connect to database, create schema, and encrypt password
mongoose.connect("mongodb://localhost:27017/userDB", {
     useNewUrlParser: true,
     useUnifiedTopology: true,
     useCreateIndex: true,
     //useFindAndModify: false, 
});

const userSchema = new mongoose.Schema({
    email: String, 
    password: String
});

// This must be used with a mongoose schema instance (not just a js object)
userSchema.plugin(passportLocalMongoose);

const User = new mongoose.model("User", userSchema);

passport.use(User.createStrategy());
passport.serializeUser(User.serializeUser());
passport.deserializeUser(User.deserializeUser());

// Routes
app.get("/", function(req, res) {
    res.render("home");
});

app.get("/login", function(req, res) {
    res.render("login");
});

app.get("/register", function(req, res) {
    res.render("register");
});

app.get("/secrets", function (req, res) {
    if (req.isAuthenticated()) {
        res.render("secrets");
    }
    else {
        res.redirect("/login");
    }
})

app.post("/register", function(req, res) {
    User.register({username: req.body.username}, req.body.password, function(err, user) {
        if (err) {
            console.log(err);
            res.redirect("/register");
        }
        else {
            passport.authenticate("local")(req, res, function() {
                res.redirect("/secrets");
            });
        }
    })
});

app.post("/login", function(req, res) {

    const user = new User({
        username: req.body.username,
        password: req.body.password,
    });

    req.login(user, function (err) {
        if (err) {
            console.log(err);
        }
        else {
            passport.authenticate("local")(req, res, function () {
                res.redirect("/secrets");
            })
        }
    });
});

app.get("/logout", function (req, res) {
    req.logout();
    res.redirect("/");
});