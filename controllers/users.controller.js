const {
  createUser,
  findUserPerUsername,
  searchUsersPerUsername,
  addUserIdToCurrentUserFollowing,
  findUserPerId,
  removeUserIdToCurrentUserFollowing,
  findUserPerEmail
} = require("../queries/users.queries");
const { getUserTweetsFormAuthorId } = require("../queries/tweets.queries");
const path = require("path");
const multer = require("multer");
const upload = multer({
  storage: multer.diskStorage({
    destination: (req, file, cb) => {
      cb(null, path.join(__dirname, "../public/images/avatars"));
    },
    filename: (req, file, cb) => {
      cb(null, `${Date.now()}-${file.originalname}`);
    }
  })
});
const emailFactory = require("../emails");
const moment = require("moment");
const uuid = require("uuid/v4");
const User = require("../database/models/user.model");

exports.userList = async (req, res, next) => {
  try {
    const search = req.query.search;
    const users = await searchUsersPerUsername(search);
    res.render("includes/search-menu", { users });
  } catch (e) {
    next(e);
  }
};

exports.userProfile = async (req, res, next) => {
  try {
    const username = req.params.username;
    const user = await findUserPerUsername(username);
    const tweets = await getUserTweetsFormAuthorId(user._id);
    res.render("tweets/tweet", {
      tweets,
      isAuthenticated: req.isAuthenticated(),
      currentUser: req.user,
      user,
      editable: false
    });
  } catch (e) {
    next(e);
  }
};

exports.signupForm = (req, res, next) => {
  res.render("users/user-form", {
    errors: null,
    isAuthenticated: req.isAuthenticated(),
    currentUser: req.user
  });
};

exports.signup = async (req, res, next) => {
  const body = req.body;
  try {
    const user = await createUser(body);
    emailFactory.sendEmailVerification({
      to: user.local.email,
      host: req.headers.host,
      username: user.username,
      userId: user._id,
      token: user.local.emailToken
    });
    res.redirect("/");
  } catch (e) {
    res.render("users/user-form", {
      errors: [e.message],
      isAuthenticated: req.isAuthenticated(),
      currentUser: req.user
    });
  }
};

exports.uploadImage = [
  upload.single("avatar"),
  async (req, res, next) => {
    try {
      const user = req.user;
      user.avatar = `/images/avatars/${req.file.filename}`;
      await user.save();
      res.redirect("/");
    } catch (e) {
      next(e);
    }
  }
];

exports.followUser = async (req, res, next) => {
  try {
    const userId = req.params.userId;
    const [, user] = await Promise.all([
      addUserIdToCurrentUserFollowing(req.user, userId),
      findUserPerId(userId)
    ]);
    res.redirect(`/users/${user.username}`);
  } catch (e) {
    next(e);
  }
};

exports.unFollowUser = async (req, res, next) => {
  try {
    const userId = req.params.userId;
    const [, user] = await Promise.all([
      removeUserIdToCurrentUserFollowing(req.user, userId),
      findUserPerId(userId)
    ]);
    res.redirect(`/users/${user.username}`);
  } catch (e) {
    next(e);
  }
};

exports.emailLinkVerification = async (req, res, next) => {
  try {
    const { userId, token } = req.params;
    const user = await findUserPerId(userId);
    if (user && token && token === user.local.emailToken) {
      user.local.emailVerified = true;
      await user.save();
      return res.redirect("/");
    } else {
      return res.status(400).json("Problem during email verification");
    }
  } catch (e) {
    next(e);
  }
};

exports.initResetPassword = async (req, res, next) => {
  try {
    const { email } = req.body;
    if (email) {
      const user = await findUserPerEmail(email);
      if (user) {
        user.local.passwordToken = uuid();
        user.local.passwordTokenExpiration = moment()
          .add(2, "hours")
          .toDate();
        await user.save();
        emailFactory.sendResetPasswordLink({
          to: email,
          host: req.headers.host,
          userId: user._id,
          token: user.local.passwordToken
        });
        return res.status(200).end();
      }
    }
    return res.status(400).json("Utilisateur inconnu");
  } catch (e) {
    next(e);
  }
};

exports.resetPasswordForm = async (req, res, next) => {
  try {
    const { userId, token } = req.params;
    const user = await findUserPerId(userId);
    if (user && user.local.passwordToken === token) {
      return res.render("auth/auth-reset-password", {
        url: `https://${req.headers.host}/users/reset-password/${user._id}/${user.local.passwordToken}`,
        errors: null,
        isAuthenticated: false
      });
    } else {
      return res.status(400).json("L'utilisateur n'existe pas");
    }
  } catch (e) {
    next(e);
  }
};

exports.resetPassowrd = async (req, res, next) => {
  try {
    const { userId, token } = req.params;
    const { password } = req.body;
    const user = await findUserPerId(userId);
    if (
      password &&
      user &&
      user.local.passwordToken === token &&
      moment() < moment(user.local.passwordTokenExpiration)
    ) {
      user.local.password = await User.hashPassword(password);
      user.local.passwordToken = null;
      user.local.passwordTokenExpiration = null;
      await user.save();
      return res.redirect("/");
    } else {
      return res.render("auth/auth-reset-password", {
        url: `https://${req.headers.host}/users/reset-password/${user._id}/${user.local.passwordToken}`,
        errors: ["Une erreur c'est produite"],
        isAuthenticated: false
      });
    }
  } catch (e) {
    next(e);
  }
};
