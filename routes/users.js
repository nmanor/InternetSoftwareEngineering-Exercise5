const express = require('express');
const router = express.Router();
const checksession = require('./checksession');
const User = require('../model')("User");
const debug = require('debug')('lab7:users');
const async = require('async');
const crypto = require('crypto');


/* GET users listing. */
router.get('/', checksession, async (req, res) => {
    debug('request users');
    try {
        res.render('users', {
            title: 'User List', admin: req.session.admin //, users: await User.REQUEST()
        });
    } catch (err) {
        debug(`get users failure: ${err}`);
    }
});

router.get('/list', checksession, async (req, res) => {
    debug('request user list');
    try {
        res.json((await User.REQUEST()).map(user =>
            ({name: user.name, username: user.username, password: user.password, admin: user.admin})));
    } catch (err) {
        debug(`get users failure: ${err}`);
    }
});

router.get('/add', checksession, async (req, res) => {
    debug('add user page');
    if (!req.session.admin) {
        debug("Must be admin to add a user!!!");
        res.redirect('/users');
    } else
        res.render('adduser', {title: 'Add user', admin: req.session.admin});
});

router.post('/', checksession, async (req, res) => {
    debug('add user');
    if (!req.session.admin)
        debug("Must be admin to add a user!!!");
    else if (req.body.user === undefined || req.body.user === null || req.body.user === "")
        debug("Missing user to add!!!");
    else if (req.body.password === undefined || req.body.password === null || req.body.password === "")
        debug("Missing password for user to add!!!");
    else if (req.body.name === undefined || req.body.name === null || req.body.name === "")
        debug("Missing name for  userto add!!!");
    else {
        let user;
        try {
            user = await User.findOne({username: req.body.user}).exec();
        } catch (err) {
            debug(`get user for adding failure: ${err}`);
        }
        if (user === null)
            try {
                await User.CREATE([req.body.name, req.body.user, req.body.password, req.body.admin !== undefined]);
                debug('User created:' + user);
            } catch (err) {
                debug("Error creating a user: " + err);
            }
        else
            debug('User to be added already exists or checkin user existence failure!');
    }
    res.redirect('/users');
});

router.delete('/:name', checksession, async (req, res) => {
    let username = req.params.name;
    debug(`delete user: ${username}`);
    if (!req.session.admin || username === 'dzilbers')
        debug("Must be admin to delete a user or can't delete THE ADMIN!!!");
    else {
        let user;
        try {
            user = await User.findOne({username: username}).exec();
        } catch (err) {
            debug(`get user for deleting failure: ${err}`);
        }
        if (user === null || user === undefined)
            debug('User to be deleted does not exist or failure checking user!');
        else {
            debug("REMOVING");
            try {
                await user.remove();
                debug('User successfully deleted!');
            } catch (err) {
                debug(`Failed deleting user: ${err}`);
            }
        }
    }
    res.send();
    //res.redirect('/users');
});

router.get('/edit', checksession, function (req, res) {
    User.findOne({_id: req.session.userId}, function (err, user) {
        res.render('edituser', {
            username: user.username, name: user.name, email: user.email, age: user.meta.age,
            website: user.meta.website, location: user.location
        });
    }).catch(_ => {
        res.send("Unauthorized access");
    });
});

router.post('/edit', checksession, async (req, res) => {
    debug('edit user');
    let user;
    try {
        user = await User.findOne({_id: req.session.userId}).exec();
    } catch (err) {
        debug(`get user for adding failure: ${err}`);
    }
    if (user !== null)
        try {
            await user.UPDATE([req.body.name, req.body.location, req.body.age, req.body.website, req.body.email]);
            debug('User updated:' + user);
        } catch (err) {
            debug("Error updating a user: " + err);
        }
    res.redirect('/');
});

router.get('/reset', checksession, async function (req, res) {
    let token;
    await async.waterfall([
        function (done) {
            crypto.randomBytes(20, function (err, buf) {
                token = buf.toString('hex');
                done(err, token);
            });
        },
        function (token, done) {
            User.findOne({_id: req.session.userId}, function (err, user) {
                if (!user) {
                    return res.redirect('/login/forgot');
                }

                user.resetPasswordToken = token;
                user.resetPasswordExpires = Date.now() + 900000; // 1/4 hour

                user.save(function (err) {
                    done(err, token, user);
                });
            });
        }
    ]);
    res.redirect(`/login/reset/${token}`);
})

module.exports = router;
