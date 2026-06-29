let clipboardText = '';

export async function writeText(text: string) {
  clipboardText = text;
}

export async function readText() {
  return clipboardText;
}

