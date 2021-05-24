module.exports = (req, res, next) => {
    if (req.session === undefined || req.session.userId === undefined)
        res.redirect('/login');
    else
        next();
};