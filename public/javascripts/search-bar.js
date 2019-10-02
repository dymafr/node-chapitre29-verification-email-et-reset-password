let menuContainer;

window.addEventListener("click", () => {
  if (menuContainer) {
    menuContainer.innerHTML = "";
  }
});

window.addEventListener("DOMContentLoaded", () => {
  menuContainer = document.querySelector("#search-menu-container");

  if (menuContainer) {
    menuContainer.addEventListener("click", e => {
      e.stopPropagation();
    });

    let searchInput = document.querySelector("#search-input");
    let ref;

    searchInput.addEventListener("input", e => {
      const value = e.target.value;
      if (ref) {
        clearTimeout(ref);
      }
      ref = setTimeout(() => {
        axios
          .get("/users?search=" + value)
          .then(response => {
            menuContainer.innerHTML = response.data;
          })
          .catch(err => {
            console.log(err);
          });
      }, 2000);
    });
  }
});
