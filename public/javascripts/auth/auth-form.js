window.addEventListener('DOMContentLoaded', () => {
  const forgot = document.querySelector('#forgot');
  if (forgot) {
    forgot.addEventListener('click', () => {
      Swal.fire({
        title: 'Renseignez votre email',
        input: 'email',
        inputPlaceholder: 'Email',
      }).then((result) => {
        const email = result.value;
        if (email) {
          axios
            .post('/users/forgot-password', {
              email: email,
            })
            .then((response) => {
              Swal.fire({
                icon: 'success',
                title: 'Vous avez recu un email avec les instructions',
              });
            })
            .catch((error) => {
              Swal.fire({
                icon: 'error',
                title: 'Une erreur est survenue',
              });
            });
        }
      });
    });
  }
});
