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
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const findOrCreate = require("mongoose-findorcreate");

//? Express v4.16.0 and higher
// --------------------------
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cors());

//? For Express version less than 4.16.0
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
    password: String,
    googleId: String,
    secret: String,
});

// This must be used with a mongoose schema instance (not just a js object)
userSchema.plugin(passportLocalMongoose);
userSchema.plugin(findOrCreate);

const User = new mongoose.model("User", userSchema);

passport.use(User.createStrategy());

passport.serializeUser(function (user, done) {
    done(null, user.id);
});

passport.deserializeUser(function (id, done) {
    User.findById(id, function (err, user) {
        done(err, user);
    });
});

passport.use(new GoogleStrategy({
    clientID: process.env.GOOGLE_CLIENT_ID,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    callbackURL: "http://localhost:5000/auth/google/secrets",
    userProfileURL: 'https://www.googleapis.com/oauth2/v3/userinfo',
},
    function (accessToken, refreshToken, profile, cb) {
        //! IMPORTANT: You must install the mongoose-findorcreate package, require it into the 
        //! module it's being called in, and then add as plugin to the userSchema before calling. 
        User.findOrCreate({ googleId: profile.id }, function (err, user) {
            return cb(err, user);
        });
    }
));

// Routes
app.get("/", function (req, res) {
    res.render("home");
});

app.get("/register", function (req, res) {
    res.render("register");
});

app.post("/register", function (req, res) {
    User.register({ username: req.body.username }, req.body.password, function (err, user) {
        if (err) {
            console.log(err);
            res.redirect("/register");
        }
        else {
            passport.authenticate("local")(req, res, function () {
                res.redirect("/secrets");
            });
        }
    });
});

app.get("/login", function (req, res) {
    res.render("login");
});

app.post("/login", function (req, res) {

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

app.get("/auth/google",
    passport.authenticate("google", { scope: ["profile"] }),
);

app.get("/auth/google/secrets",
    passport.authenticate("google", { failureRedirect: "/login" }),
    function (req, res) {
        // Successful authentication, redirect to secrets.
        res.redirect("/secrets");
    }
);

app.get("/secrets", function (req, res) {
    User.find({ "secret": { $ne: null } }, function (err, foundUsers) {
        if (err) {
            console.log(err);
        } else {
            if (foundUsers) {
                res.render("secrets", { usersWithSecrets: foundUsers });
            }
        }
    });
    //! If you only want registered users to see the secrets list, then implement some sort of auth
    // if (req.isAuthenticated()) {
    //     res.render("secrets");
    // }
    // else {
    //     res.redirect("/login");
    // }
});

app.get("/submit", function (req, res) {
    if (req.isAuthenticated()) {
        res.render("submit");
    }
    else {
        res.redirect("/login");
    }
});

app.post("/submit", function (req, res) {
    const usersSubmittedSecret = req.body.secret;
    // find who current user is (always saved to req variable);
    User.findById({ _id: req.user._id }, function (err, foundUser) {
        if (err) {
            console.log(err);
        }
        else {
            if (foundUser) {
                foundUser.secret = usersSubmittedSecret;
                foundUser.save(function (err) {
                    if (err) {
                        res.send(err);
                    } else {
                        res.redirect("/secrets");
                    }
                });
            }
        }
    });
});

app.get("/logout", function (req, res) {
    req.logout();
    res.redirect("/");
});

//! OAuth redirect URI
// http://localhost:5000/auth/google/secrets