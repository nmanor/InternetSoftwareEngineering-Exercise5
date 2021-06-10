const express = require('express');
const router = express.Router();
const User = require('../model')("User");
const debug = require('debug')('lab7:login');
const passport = require('passport');
const flash = require('express-flash');
const async = require('async');
const crypto = require('crypto');
const CryptoJS = require('crypto-js');
const nodemailer = require('nodemailer');
const smtpTransport = require('nodemailer-smtp-transport');
const LocalStrategy = require('passport-local').Strategy

router.use(passport.initialize());
router.use(passport.session());
router.use(flash());

passport.use(new LocalStrategy(
    function (username, password, done) {
        User.findOne({username: username}, function (err, user) {
            if (err) {
                return done(err);
            }
            if (!user) {
                return done(null, false);
            }
            if (!user.verifyPassword(password)) {
                return done(null, false);
            }
            return done(null, user);
        });
    }
));
passport.serializeUser(User.serializeUser());
passport.deserializeUser(User.deserializeUser());

router.get('/', async (req, res) => {
    if (req.session.userId === undefined) {
        req.session.referer = req.get('Referer');
        if (req.session.referer === undefined)
            req.session.referer = '/';
        res.render("login", {title: "Login", problem: req.session.badLogin});
    } else
        res.redirect('/');
});

router.post('/', function (req, res, next) {
    passport.authenticate('local', function (err, user, info) {
        let session = req.session;

        // if an error accord
        if (err) {
            debug(`Login error: ${err}`);
            session.badLogin = "Login error";
            res.redirect(req.session.referer);
            return;
        }

        // is the username or password are incorrect
        if (!user) {
            debug(`Login no user: ${req.body.username}`);
            session.badLogin = `User '${req.body.username}' or its password aren't correct`;
            res.redirect(req.session.referer);
            return;
        }

        // if the user name and password are correct
        debug(`Logged to: ${user.username}`);
        delete session.badLogin;
        session.userId = user.id;
        session.admin = user.admin;
        session.userName = user.name;
        session.count = 0;
        res.redirect(req.session.referer);
    })(req, res, next);
});

router.get("/register", function (req, res) {
    res.render("register", {problem: undefined});
});

router.post("/register", async function (req, res) {
    let user;
    try {
        user = await User.findOne({username: req.body.username}).exec();
    } catch (err) {
        debug(`get user for adding failure: ${err}`);
        res.render("register", {problem: `get user for adding failure: ${err}`});
        return;
    }

    if (user === null)
        try {
            await User.CREATE([req.body.name, req.body.username, req.body.password, false, req.body.location,
                req.body.age, req.body.website, req.body.email]);
            debug('User created:' + user);
            user = await User.findOne({username: req.body.username}).exec();
        } catch (err) {
            res.render("register", {problem: `Error creating a user: ${err}`});
            return;
        }
    else {
        debug('User to be added already exists or checkin user existence failure!');
        res.render("register", {problem: 'User to be added already exists'});
        return;
    }

    // log in to the user page
    let session = req.session;
    debug(`Logged to: ${user.username}`);
    delete session.badLogin;
    session.userId = user.id;
    session.admin = user.admin;
    session.userName = user.name;
    session.count = 0;
    res.redirect(req.session.referer);
});

router.get('/forgot', function (req, res) {
    res.render('forgot', {message: ""});
});

router.post('/forgot', function (req, res, next) {
    async.waterfall([
        function (done) {
            crypto.randomBytes(20, function (err, buf) {
                let token = buf.toString('hex');
                done(err, token);
            });
        },
        function (token, done) {
            User.findOne({email: req.body.email}, function (err, user) {
                if (!user) {
                    req.flash('error', 'No account with that email address exists.');
                    res.redirect('/login/forgot');
                    return
                }

                user.resetPasswordToken = token;
                user.resetPasswordExpires = Date.now() + 3600000; // 1 hour

                user.save(function (err) {
                    done(err, token, user);
                });
            });
        },
        function (token, user, done) {
            let transport = nodemailer.createTransport(smtpTransport({
                service: 'gmail',
                host: 'smtp.gmail.com',
                auth: {
                    user: 'projectlev2021@gmail.com',
                    pass: 'project_lev_2021'
                }
            }));
            let mailOptions = {
                to: user.email,
                from: 'projectlev2021@gmail.com',
                subject: 'Reset your site password',
                text: 'Dear ' + user.name + ',\nThere was a recent request to change the password for your account.\n' +
                    'If you are interested in changing this password, please click on the following link:\n' +
                    'https://' + req.headers.host + '/login/reset/' + token + '\n\n' +
                    'If clicking the link does not work, please copy and paste the URL into your browser.\n' +
                    'If you do not request it, please ignore this message and your password will remain the same.\n' +
                    'For your attention, this link will be available only for the next hour.'
            };
            transport.sendMail(mailOptions, function (err) {
                req.flash('info', 'An e-mail has been sent to ' + user.email + ' with further instructions.');
                done(err, 'done');
            });
        }
    ], function (err) {
        if (err) return next(err);
        res.render('forgot', {message: "An e-mail has been sent to " + req.body.email + " with further instructions."});
    });
});

router.get('/reset/:token', function (req, res) {
    User.findOne({resetPasswordToken: req.params.token, resetPasswordExpires: {$gt: Date.now()}}, function (err, user) {
        if (!user) {
            res.render('forgot', {message: "Password reset token is invalid or has expired."});
            return;
        }
        res.render('reset', {
            user: req.user
        });
    });
});

router.post('/reset/:token', function (req, res) {
    User.findOne({resetPasswordToken: req.params.token, resetPasswordExpires: {$gt: Date.now()}}, function (err, user) {
        if (!user) {
            res.render('forgot', {message: "Password reset token is invalid or has expired."});
            return;
        }

        user.password = req.body.password;
        user.resetPasswordToken = undefined;
        user.resetPasswordExpires = undefined;

        user.save(function (err) {
            if (err) res.render('forgot', {message: "Password reset token is invalid or has expired."});
            req.session.referer = '/';
            let session = req.session;
            debug(`Logged to: ${user.username}`);
            delete session.badLogin;
            session.userId = user.id;
            session.admin = user.admin;
            session.userName = user.name;
            session.count = 0;
            res.redirect(req.session.referer);
        });
    });
});

module.exports = router;
