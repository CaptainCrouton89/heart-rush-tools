export default {
  fetch(request: Request): Response {
    const source = new URL(request.url)
    const target = new URL(source.pathname + source.search, 'https://rules.heartrush.party')
    return Response.redirect(target, 301)
  },
}
