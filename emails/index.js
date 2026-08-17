const { Resend } = require("resend");
const nodemailer = require("nodemailer");
const path = require("path");
const pug = require("pug");

class Email {
  constructor() {
    // Nous affichons comme nom d'expéditeur Dyma projects
    // Nous utilisons le no-reply@dyma-projects.site comme adresse d'envoi.
    // Nous ne l'avons pas créée car nous ne souhaitons pas recevoir de réponse
    this.from = "Dyma projects <no-reply@dyma-projects.site>";

    // Le SDK Resend sert en production. Sa clé d'API vient de
    // l'environnement : elle n'a rien à faire dans le code du projet.
    this.resend = new Resend(process.env.RESEND_API_KEY);

    // Pour le développement, nous envoyons vers la boîte de test Mailtrap.
    // C'est un vrai serveur SMTP, donc c'est nodemailer qui lui parle.
    this.devTransporter = nodemailer.createTransport({
      host: "sandbox.smtp.mailtrap.io",
      port: 2525,
      auth: {
        user: process.env.MAILTRAP_USER,
        pass: process.env.MAILTRAP_PASS
      }
    });
  }

  // Une seule méthode d'envoi, que toutes les autres utiliseront.
  // C'est le seul endroit qui sait s'il faut passer par Resend ou par
  // la boîte de test :
  async send(email) {
    if (process.env.NODE_ENV !== "production") {
      return this.devTransporter.sendMail({ from: this.from, ...email });
    }
    const { data, error } = await this.resend.emails.send({
      from: this.from,
      to: [email.to],
      subject: email.subject,
      html: email.html
    });
    // Attention : le SDK ne lève pas d'exception quand l'envoi échoue,
    // il rend l'erreur dans la réponse. Un bloc try / catch autour de
    // l'appel ne verrait donc jamais rien passer :
    if (error) {
      throw new Error(error.message);
    }
    return data;
  }

  // Nous créons la méthode pour envoyer l'email permettant la validation
  // de l'email de l'utilisateur :
  async sendEmailVerification(options) {
    return this.send({
      subject: "Email verification",
      // Nous passerons l'email de l'utilisateur dans l'objet options :
      to: options.to,
      html: pug.renderFile(
        // Nous utilisons le module path pour ne pas avoir d'erreur de chemins :
        path.join(__dirname, "templates/email-verification.pug"),
        {
          // Nous passerons le pseudo en options qui sera affiché dans l'email :
          username: options.username,
          // Pour le lien de validation, nous avons besoin de l'id de l'utilisateur et du token.
          // Nous passons également l'hôte en options :
          url: `https://${options.host}/users/email-verification/${options.userId}/${options.token}`
        }
      )
    });
  }

  async sendResetPasswordLink(options) {
    return this.send({
      subject: "Password reset",
      to: options.to,
      html: pug.renderFile(
        path.join(__dirname, "templates/password-reset.pug"),
        {
          url: `https://${options.host}/users/reset-password/${options.userId}/${options.token}`
        }
      )
    });
  }
}

module.exports = new Email();
