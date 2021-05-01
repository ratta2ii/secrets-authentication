var express = require("express");
var passport = require('passport');
const { User } = require("./../database/db.js");
var router = express.Router();


router.get("/", function (req, res) {
    res.render("home");
});

router.get("/register", function (req, res) {
    res.render("register");
});

router.post("/register", function (req, res) {

    User.findOne({ username: req.body.username }, async function (err, foundUser) {
        if (err) console.log(err);
        else {
            if (!foundUser) {
                const user = new User({ username: req.body.username });
                await user.setPassword(req.body.password);
                user.localAccount = true;
                await user.save();
                passport.authenticate("local")(req, res, function () {
                    res.redirect("/login");
                });
            } else {
                // if a user exists through alternate OAuth, but no local strategy or password
                if (!foundUser.localAccount) {
                    await foundUser.setPassword(req.body.password);
                    // (NOTES: @AUTHROUTES 001)
                    foundUser.localAccount = true;
                    await foundUser.save();
                    passport.authenticate("local")(req, res, function () {
                        res.redirect("/login");
                    });
                } else {
                    console.log("This account already exists!");
                    res.redirect("/login");
                }
            }
        }
    });
    // (NOTES: @AUTHROUTES 002)
});

router.get("/login", function (req, res) {
    res.render("login");
});

router.post("/login", function (req, res) {
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
router.get("/auth/google",
    passport.authenticate("google", { scope: ["profile", "email"] }),
);

router.get("/auth/google/secrets",
    passport.authenticate("google", { failureRedirect: "/login" }),
    function (req, res) {
        // See alternate method in "/auth/facebook/secrets" route
        res.redirect("/secrets");
    }
);

//! Facebook OAuth Routes
router.get("/auth/facebook",
    passport.authenticate("facebook", { scope: ["email"] })
);

router.get("/auth/facebook/secrets",
    passport.authenticate("facebook", {
        successRedirect: "/secrets",
        failureRedirect: "/login"
    }), (err) => {
        console.log("/auth/facebook/secrets: ", err);
    }
);

router.get("/secrets", function (req, res) {
    console.log({ "USER AUTHENTICATED: ": req.isAuthenticated() });
    if (req.isAuthenticated()) {
        // Find all users that have posted a secret and then display them all (ne = not equal)
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

router.get("/submit", function (req, res) {
    if (req.isAuthenticated()) {
        res.render("submit");
    }
    else {
        res.redirect("/login");
    }
});

router.post("/submit", function (req, res) {
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

//! Logout (end session)
router.get("/logout", function (req, res) {
    req.logout();
    res.redirect("/");
});

module.exports = router;










//! REFERENCE NOTES BELOW
//? -----------------------------------------------------


/*  
? (REF: @AUTHROUTES 001)
NOTE: "localAccount" is a Boolean property on the userSchema. Because users may first gain access through alternate OAuth methods (google, fb, etc.), I needed a way to check if the user currently registering "locally", had already registered locally before. Structuring the schema with this additional Boolean allowed me greater control when writing the conditional statements. This helped to prevent someone from registering a second time on an existing account (previously created through alt OAuth), which would have resulted in overwriting any previous passwords.
That said, I was originally faced with this issue after having trouble running conditional statements on any database field values that were security related (ex: password, salt, hash). This is my reasoning behind creating an additional Boolean field-localAccount- that would keep track of whether or not a local strategy already exists on a user entry.

? (REF: @AUTHROUTES 002)
This an alternate way of registering a new user with the passport-local-mongoose package.
Starting with version 5.0.0 passport-local-mongoose is async/await enabled by returning
Promises for all instances and static methods -except, serializeUser and deserializeUser.
* URI: npmjs.com/package/passport-local-mongoose
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

? In a simpler form, implementing AUTH to a route (inside) looks something like this
? The req object contains a method to confirm authenticatin
if (req.isAuthenticated()) {
    res.render("secrets");
}
else {
    res.redirect("/login");
} 
*/