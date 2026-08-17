const {
  createUser,
  findUserPerUsername,
  searchUsersPerUsername,
  addUserIdToCurrentUserFollowing,
  findUserPerId,
  removeUserIdToCurrentUserFollowing,
  findUserPerEmail,
} = require('../queries/users.queries');
const { getUserTweetsFormAuthorId } = require('../queries/tweets.queries');
const path = require('path');
const multer = require('multer');
const upload = multer({
  storage: multer.diskStorage({
    destination: (req, file, cb) => {
      cb(null, path.join(__dirname, '../public/images/avatars'));
    },
    filename: (req, file, cb) => {
      cb(null, `${Date.now()}-${file.originalname}`);
    },
  }),
});
const emailFactory = require('../emails');
const { randomUUID } = require('node:crypto');
const User = require('../database/models/user.model');

exports.userList = async (req, res, next) => {
  try {
    const search = req.query.search;
    const users = await searchUsersPerUsername(search);
    res.render('includes/search-menu', { users });
  } catch (e) {
    next(e);
  }
};

exports.userProfile = async (req, res, next) => {
  try {
    const username = req.params.username;
    const user = await findUserPerUsername(username);
    const tweets = await getUserTweetsFormAuthorId(user._id);
    res.render('tweets/tweet', {
      tweets,
      isAuthenticated: req.isAuthenticated(),
      currentUser: req.user,
      user,
      editable: false,
    });
  } catch (e) {
    next(e);
  }
};

exports.signupForm = (req, res, next) => {
  res.render('users/user-form', {
    errors: null,
    isAuthenticated: req.isAuthenticated(),
    currentUser: req.user,
  });
};

exports.signup = async (req, res, next) => {
  const body = req.body;
  try {
    const user = await createUser(body);
    // Nous n'attendons pas l'envoi de l'email pour répondre, mais une
    // promesse rejetée sans rattrapage arrête le processus Node :
    emailFactory
      .sendEmailVerification({
        to: user.local.email,
        host: req.headers.host,
        username: user.username,
        userId: user._id,
        token: user.local.emailToken,
      })
      .catch((e) => console.error(e));
    res.redirect('/');
  } catch (e) {
    res.render('users/user-form', {
      errors: [e.message],
      isAuthenticated: req.isAuthenticated(),
      currentUser: req.user,
    });
  }
};

exports.uploadImage = [
  upload.single('avatar'),
  async (req, res, next) => {
    try {
      const user = req.user;
      user.avatar = `/images/avatars/${req.file.filename}`;
      await user.save();
      res.redirect('/');
    } catch (e) {
      next(e);
    }
  },
];

exports.followUser = async (req, res, next) => {
  try {
    const userId = req.params.userId;
    const [, user] = await Promise.all([
      addUserIdToCurrentUserFollowing(req.user, userId),
      findUserPerId(userId),
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
      findUserPerId(userId),
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
    // Nous exigeons qu'il y ait un token en base : sans ce test, un compte
    // déjà validé, dont le token vaut null, laisserait passer une requête
    // envoyant la chaîne "null".
    if (user && user.local.emailToken && token === user.local.emailToken) {
      user.local.emailVerified = true;
      // Le lien ne doit servir qu'une fois :
      user.local.emailToken = null;
      await user.save();
      return res.redirect('/');
    } else {
      return res.status(400).json('Problem during email verification');
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
        user.local.passwordToken = randomUUID();
        user.local.passwordTokenExpiration = new Date(
          Date.now() + 2 * 60 * 60 * 1000
        );
        await user.save();
        emailFactory
          .sendResetPasswordLink({
            to: email,
            host: req.headers.host,
            userId: user._id,
            token: user.local.passwordToken,
          })
          .catch((e) => console.error(e));
      }
    }
    // La même réponse dans tous les cas, que le compte existe ou non :
    // répondre « utilisateur inconnu » transformerait ce formulaire en
    // annuaire de nos inscrits.
    return res.status(200).end();
  } catch (e) {
    next(e);
  }
};

exports.resetPasswordForm = async (req, res, next) => {
  try {
    const { userId, token } = req.params;
    const user = await findUserPerId(userId);
    // Nous vérifions aussi la date d'expiration : sans ce test, un lien
    // vieux de trois jours ouvrirait encore le formulaire.
    if (
      user &&
      user.local.passwordToken &&
      user.local.passwordToken === token &&
      user.local.passwordTokenExpiration > new Date()
    ) {
      return res.render('auth/auth-reset-password', {
        url: `https://${req.headers.host}/users/reset-password/${user._id}/${user.local.passwordToken}`,
        errors: null,
        isAuthenticated: false,
      });
    }
    // Un seul message pour les trois cas : utilisateur introuvable, token
    // qui ne correspond pas, lien expiré.
    return res.status(400).json('Ce lien n\'est plus valable');
  } catch (e) {
    next(e);
  }
};

exports.resetPassword = async (req, res, next) => {
  try {
    const { userId, token } = req.params;
    const { password } = req.body;
    const user = await findUserPerId(userId);

    // Le lien invalide est traité en premier, et il sort de la fonction :
    // sans cela, la branche qui réaffiche le formulaire lirait user._id
    // alors que user peut valoir null.
    if (
      !user ||
      !user.local.passwordToken ||
      user.local.passwordToken !== token ||
      user.local.passwordTokenExpiration <= new Date()
    ) {
      return res.status(400).json('Ce lien n\'est plus valable');
    }

    if (!password || password.length < 8) {
      return res.render('auth/auth-reset-password', {
        url: `https://${req.headers.host}/users/reset-password/${user._id}/${user.local.passwordToken}`,
        errors: ['Le mot de passe doit faire au moins huit caractères'],
        isAuthenticated: false,
      });
    }

    user.local.password = await User.hashPassword(password);
    // Le token ne sert qu'une fois : nous l'effaçons avec sa date.
    user.local.passwordToken = null;
    user.local.passwordTokenExpiration = null;
    await user.save();
    return res.redirect('/');
  } catch (e) {
    next(e);
  }
};
