/**
 * Navigation minimale par le hash (#/ et #/e/<id>) : pas de serveur à configurer
 * sur GitHub Pages, et un rechargement garde l'écran courant.
 */
export type Route =
  | { name: 'home' }
  | { name: 'envelope'; id: string }
  | { name: 'savings' }
  | { name: 'settings' };

function parse(hash: string): Route {
  if (hash === '#/epargne') return { name: 'savings' };
  if (hash === '#/reglages') return { name: 'settings' };
  const match = /^#\/e\/(.+)$/.exec(hash);
  return match ? { name: 'envelope', id: decodeURIComponent(match[1]) } : { name: 'home' };
}

class Router {
  route = $state<Route>(parse(location.hash));
  /** Vrai si on est arrivé ici depuis l'app (sinon « retour » ferait quitter l'app). */
  #navigated = false;

  constructor() {
    addEventListener('hashchange', () => {
      this.route = parse(location.hash);
      window.scrollTo(0, 0);
    });
  }

  openEnvelope(id: string) {
    this.#navigated = true;
    location.hash = `#/e/${encodeURIComponent(id)}`;
  }

  openSavings() {
    this.#navigated = true;
    location.hash = '#/epargne';
  }

  openSettings() {
    this.#navigated = true;
    location.hash = '#/reglages';
  }

  back() {
    if (this.#navigated) history.back();
    else location.replace('#/');
    this.#navigated = false;
  }
}

export const router = new Router();
