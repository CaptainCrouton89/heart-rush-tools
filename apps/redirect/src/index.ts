export default {
  fetch(request: Request): Response {
    const source = new URL(request.url)
    const target = new URL('https://rules.heartrush.party')
    target.pathname = source.pathname
    target.search = source.search
    return Response.redirect(target, 301)
  },
}
