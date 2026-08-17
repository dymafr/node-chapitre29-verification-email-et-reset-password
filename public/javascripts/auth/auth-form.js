window.addEventListener('DOMContentLoaded', () => {
  const forgot = document.querySelector('#forgot');
  if (forgot) {
    forgot.addEventListener('click', () => {
      Swal.fire({
        title: 'Renseignez votre email',
        input: 'email',
        inputPlaceholder: 'Email',
        confirmButtonText: 'Envoyer',
        showCancelButton: true,
        cancelButtonText: 'Annuler',
      }).then((result) => {
        // isConfirmed distingue le bouton de validation de l'annulation
        // et de la fermeture par la touche d'échappement :
        if (!result.isConfirmed || !result.value) {
          return;
        }
        axios
          .post('/users/forgot-password', { email: result.value })
          .then(() => {
            Swal.fire({
              icon: 'success',
              title:
                'Si un compte existe pour cette adresse, vous allez recevoir un email',
            });
          })
          .catch(() => {
            Swal.fire({
              icon: 'error',
              title: 'Une erreur est survenue',
            });
          });
      });
    });
  }
});
