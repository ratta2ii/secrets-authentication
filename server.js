require("dotenv").config();
const express = require("express");
const _ = require("lodash");
var cors = require("cors");
const app = express();
const mongoose = require("mongoose");
const session = require("express-session");
const passport = require("passport");
const passportLocalMongoose = require("passport-local-mongoose");
const findOrCreate = require("mongoose-findorcreate");
const GoogleStrategy = require("passport-google-oauth20").Strategy;
const FacebookStrategy = require("passport-facebook").Strategy;

//? Express v4.16.0 and higher
// --------------------------
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cors());

//? For Express version less than 4.16.0
// ------------------------------------
// const bodyParser = require("body-parser");
// app.use(express.json());
// app.use(bodyParser.urlencoded({extended: true}));

// Use for serving ejs pages or css, images, etc here in server
app.set("view engine", "ejs");
app.use(express.static("public"));

// Cookies and Sessions (express-session)
app.use(session({
    secret: process.env.APP_SECRET,
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
    //* username will be the users email address
    username: { type: String, require: true, index: true, unique: true, sparse: true },
    accounts: Map,
    // Map structure
    // {
    //     accountType: "twitter",
    //     uid: 23984y9238470982734098
    // },
    // {possible idea}
    // { 
    //     accountType: "internal", // or local
    //     username: "bob@gmail.com",
    //     password: "5d41402abc4b2a76b9719d911017c592"
    // },
    //* This app is about users posting a personal secret, not part of securtiy in this context 
    secret: String,
    salt: String,
    hash: String,
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

//! Google OAuth 2.0 (PRESERVED: WORKS GREAT: DRYING UP CODE)
passport.use(new GoogleStrategy({
    clientID: process.env.GOOGLE_CLIENT_ID,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    callbackURL: process.env.GOOGLE_CALLBACK_URL,
    userProfileURL: "https://www.googleapis.com/oauth2/v3/userinfo",
},
    function (accessToken, refreshToken, profile, done) {
        //! IMPORTANT: You must install mongoose-findorcreate package before using the method
        User.findOrCreate({ username: profile._json.email }, function (err, user) {
            if (!err) {
                const newGoogleAccountObj = { accountType: "google", uid: profile.id };
                console.log("PROFILE: ", profile)
                // Create new map for user accounts ONLY ONCE (empty map is still falsy)
                if (user && !user.accounts) {
                    user.accounts = new Map();
                    user.accounts.set("google", newGoogleAccountObj);
                    user.save();
                }
                // If no google account currently exists in the existing map
                else if (!user.accounts.get("google")) {
                    user.accounts.set("google", newGoogleAccountObj);
                    user.save();
                }
                console.log("GOOGLE USER: ", user);
                return done(err, user);
            } else {
                console.log(err);
            }
        });
    }
));

//! Facebook OAuth 2.0
passport.use(
    new FacebookStrategy(
        {
            clientID: process.env.FACEBOOK_CLIENT_ID,
            clientSecret: process.env.FACEBOOK_CLIENT_SECRET,
            callbackURL: process.env.FACEBOOK_CALLBACK_URL,
            profileFields: ["id", "displayName", "email"]
        },
        function (accessToken, refreshToken, profile, done) {
            //! IMPORTANT: You must install mongoose-findorcreate package before using the method
            User.findOrCreate({ username: profile._json.email }, function (err, user) {
                if (!err) {
                    const newFacebookAccessObj = { accountType: "facebook", uid: profile._json.id };
                    // Create new map for user accounts ONLY ONCE && an empty map is still falsy
                    if (user && !user.accounts) {
                        user.accounts = new Map();
                        user.accounts.set("facebook", newFacebookAccessObj);
                        user.save();
                    }
                    // If there other accounts but no facebook, then add FB account
                    else if (!user.accounts.get("facebook")) {
                        user.accounts.set("facebook", newFacebookAccessObj);
                        user.save();
                    }
                    console.log("FACEBOOK USER: ", user);
                    return done(err, user);
                } else {
                    console.log(err);
                }
            });
        }
    )
);

// Routes
app.get("/", function (req, res) {
    res.render("home");
});

app.get("/register", function (req, res) {
    res.render("register");
});

app.post("/register", function (req, res) {

    User.findOne({ username: req.body.username }, async function (err, foundUser) {
        if (err) console.log(err);
        else {
            if (foundUser) {
                await foundUser.setPassword(req.body.password);
                await foundUser.save();
                passport.authenticate("local")(req, res, function () {
                    res.redirect("/secrets");
                });
            } else {
                const user = new User({ username: req.body.username });
                await user.setPassword(req.body.password);
                await user.save();
                passport.authenticate("local")(req, res, function () {
                    res.redirect("/secrets");
                });
            }
        }
    });

    //? This an alternate way of registering a new user with the passport-local-mongoose package. Starting with version 5.0.0 passport-local-mongoose is async/await enabled by returning Promises for all instances and static methods -except, serializeUser and deserializeUser
    //* URI: npmjs.com/package/passport-local-mongoose
    // User.register({ username: req.body.username }, req.body.password, function (err, user) {
    //     if (err) {
    //         console.log(err);
    //         res.redirect("/register");
    //     }
    //     else {
    //         passport.authenticate("local")(req, res, function () {
    //             res.redirect("/secrets");
    //         });
    //     }
    // });
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
            });
        }
    });
});

//! Google OAuth Routes
app.get("/auth/google",
    passport.authenticate("google", { scope: ["profile", "email"] }),
);

app.get("/auth/google/secrets",
    passport.authenticate("google", { failureRedirect: "/login" }),
    function (req, res) {
        // Successful authentication, redirect to secrets. (alternate method below)
        res.redirect("/secrets");
    }
);

//! Facebook OAuth Routes
app.get("/auth/facebook",
    passport.authenticate("facebook", { scope: ["email"] })
);

app.get("/auth/facebook/secrets",
    passport.authenticate("facebook", {
        successRedirect: "/secrets",
        failureRedirect: "/login"
    }), (err) => {
        console.log(err);
    }
);

app.get("/secrets", function (req, res) {
    console.log({ "USER AUTHENTICATED: ": req.isAuthenticated() });
    if (req.isAuthenticated()) {
        // Find all users that have posted a secret and then display them all
        User.find({ "secret": { $ne: null } }, function (err, foundUsers) {
            if (err) {
                console.log(err);
            } else {
                if (foundUsers) {
                    res.render("secrets", { usersWithSecrets: foundUsers });
                }
            }
        });
    } else {
        res.redirect("/login");
    }
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

//! Logout
app.get("/logout", function (req, res) {
    req.logout();
    res.redirect("/");
});






//! Future schema (DO NOT DELETE)
// var userSchema = new mongoose.Schema({
//     local: {
//         name: { type: String },
//         email: { type: String, require: true, index: true, unique: true, sparse: true },
//         password: { type: String, require: true },
//     },
//     facebook: {
//         id: { type: String },
//         token: { type: String },
//         email: { type: String },
//         name: { type: String }
//     }
// });

//? Unused/Duplicate routes
// app.get("/fail", (req, res) => {
//   res.send("Failed attempt");
// });

// app.get("/", (req, res) => {
//   res.send("Success");
// });

// app.get("/auth/facebook/secrets",
//     passport.authenticate("google", { failureRedirect: "/login" }),
//     function (req, res) {
//         res.redirect("/secrets");
//     }
// );

// app.get("/auth/facebook/secrets",
//   passport.authenticate("facebook", {
//     successRedirect: "/secrets",
//     failureRedirect: "/login"
//   })
// );

//? In a simpler form, implementing AUTH to a route (inside) looks something like this
//? The req object contains a method to confirm authenticatin
// if (req.isAuthenticated()) {
//     res.render("secrets");
// }
// else {
//     res.redirect("/login");
// }

//? This was in /register route > User.findOne > (foundUser) > TOP
//? If a user first registered with OAuth, the password is not encrypted
//? You could remove the user and recreate while appending OAuth accounts
//? This is certainly not ideal, so remove this solution at appropriate time
// // Step 1. Save accounts property of existing user before deleting original entry
// const accountsToTransfer = foundUser.accounts;
// // Step 2. Delete the original entry that doesn't contain any password security
// await User.deleteOne({ username: req.body.username });
// // Step 3. Create a new user that includes password security, add accounts and save 
// const user = new User({ username: req.body.username });
// await user.setPassword(req.body.password);
// user.accounts = accountsToTransfer;
// await user.save();
//! Use returnNewDocument is true to return new doc instead of the original
//? (END OF REPLACEMENT SOLUTION)

//? Some code palying with JS Map
// let myMap = new Map();
// myMap.set("twitter", { id: 7, name: "Trevor" });
// myMap.size;
// myMap.get("twitter");

//! DRY CODE SNIPPET BELOW to replace code inside strategies (refactoring coming)
//! Google OAuth 2.0
// passport.use(new GoogleStrategy({
//     clientID: process.env.GOOGLE_CLIENT_ID,
//     clientSecret: process.env.GOOGLE_CLIENT_SECRET,
//     callbackURL: process.env.GOOGLE_CALLBACK_URL,
//     userProfileURL: "https://www.googleapis.com/oauth2/v3/userinfo",
// },
//     function (accessToken, refreshToken, profile, done) {
//         //! IMPORTANT: You must install mongoose-findorcreate package before using the method
//         User.findOrCreate({ username: profile._json.email }, async function (err, user) {
//             if (!err) {
//                 const newGoogleAccountObj = { accountType: "google", uid: profile.id };
//                 await createNewAuthAccount(user, newGoogleAccountObj);
//                 return done(err, user);
//             } else {
//                 console.log(err);
//             }
//         });
//     }
// ));

// //* This is invoked inside various strategies (facebook, google, etc.)
// function createNewAuthAccount(user, newAccountObj) {
//     // Create new map for a users account property -ONLY ONCE- (empty map is still falsy)
//     if (user && !user.accounts) {
//         user.accounts = new Map();
//         user.accounts.set(newAccountObj.accountType, newAccountObj);
//         user.save();
//     }
//     // If the specified account does not exists in the already existing account map
//     else if (!user.accounts.get(newAccountObj.accountType)) {
//         user.accounts.set(newAccountObj.accountType,  newAccountObj);
//         user.save();
//     }
//     console.log(`${newAccountObj.accountType} account added to accounts map on USER: `, user);
//     return user;
// }