/** Petit message temporaire en bas de l'écran (confirmation, rappel de virement). */
class Toast {
  message = $state<string | null>(null);
  #timer: ReturnType<typeof setTimeout> | undefined;

  show(message: string, durationMs = 2500) {
    this.message = message;
    clearTimeout(this.#timer);
    this.#timer = setTimeout(() => (this.message = null), durationMs);
  }

  hide() {
    clearTimeout(this.#timer);
    this.message = null;
  }
}

export const toast = new Toast();
