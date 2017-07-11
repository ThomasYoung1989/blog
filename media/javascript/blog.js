// Generated by CoffeeScript 1.6.3
(function() {
  var $, navi, navlist;

  $ = function(str) {
    return document.getElementById(str);
  };

  navlist = $('nav').children;

  navi = function() {
    var pathname;
    if (window.location.href !== location.origin + '/') {
      pathname = location.pathname;
      if (pathname === '/categories.html') {
        return navlist[2].className = 'nav-selected';
      } else if (pathname === '/archive.html') {
        return navlist[3].className = 'nav-selected';
      } else if (pathname === '/links.html') {
        return navlist[4].calssName = 'nav-selected';
      } else if (pathname === '/about.html') {
        return navlist[5].className = 'nav-selected';
      }
    } else {
      return navlist[1].className = 'nav-selected';
    }
  };

  window.onload = navi();

}).call(this);
