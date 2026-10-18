function markDeprecatedRoute(routeLabel) {
  return (req, res, next) => {
    res.set("Deprecation", "true");
    res.set("X-Deprecated-Route", routeLabel);
    next();
  };
}

module.exports = {
  markDeprecatedRoute,
};
