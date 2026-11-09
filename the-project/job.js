// Creates a "Read <url>" todo for a random Wikipedia article.
// Special:Random answers with a redirect, so we do not follow it:
// the article's address is in the Location header.
 
function requiredString(name) {
  const value = process.env[name];
  if (!value) {
    console.error(`Environment variable ${name} must be set`);
    process.exit(1);
  }
  return value;
}
 
function requiredInt(name) {
  const value = Number(process.env[name]);
  if (!Number.isInteger(value) || value <= 0) {
    console.error(`Environment variable ${name} must be set to a positive integer`);
    process.exit(1);
  }
  return value;
}
 
const backendUrl = requiredString('BACKEND_URL');
const randomUrl = requiredString('WIKI_RANDOM_URL');
const userAgent = requiredString('USER_AGENT');
const maxTodoLength = requiredInt('MAX_TODO_LENGTH');
const maxAttempts = requiredInt('MAX_ATTEMPTS');
 
// Node hides the real reason for "fetch failed" in err.cause, so dig it out.
function describe(err) {
  const c = err.cause;
  if (!c) return err.message;
  const inner = c.errors ? c.errors.map((e) => e.code || e.message).join(', ') : c.code || c.message;
  return `${err.message} (${inner})`;
}
 
async function randomArticleUrl() {
  const res = await fetch(randomUrl, {
    redirect: 'manual',
    headers: { 'User-Agent': userAgent },
  });
  await res.body?.cancel();
  const location = res.headers.get('location');
  if (res.status < 300 || res.status >= 400 || !location) {
    throw new Error(`Expected a redirect from ${randomUrl}, got status ${res.status}`);
  }
  return new URL(location, randomUrl).href;
}
 
async function main() {
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    const url = await randomArticleUrl();
    const todo = `Read ${url}`;
 
    if (todo.length > maxTodoLength) {
      console.log(`Attempt ${attempt}: todo would be ${todo.length} characters, trying another article`);
      continue;
    }
 
    const res = await fetch(backendUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ todo }),
    });
    if (res.status !== 201) {
      throw new Error(`Backend answered ${res.status}: ${await res.text()}`);
    }
    console.log(`Created todo: ${todo}`);
    return;
  }
  throw new Error(`No article short enough after ${maxAttempts} attempts`);
}
 
main().catch((err) => {
  console.error(describe(err));
  process.exit(1);
});
