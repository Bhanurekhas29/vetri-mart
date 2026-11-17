// Product form helper (admin panel). The look is in product_form.css; this file adds:
// 1. Section headings: a bold title, a coloured tag (Required / Recommended / Optional) and a help line.
// 2. "Version 1", "Version 2" ... and "Picture 1" ... numbering, and tidier "+ Add another ..." links.
// 3. The "Extras (optional)" box moves to the bottom of the page and starts folded shut.
// 4. When a category is chosen, the Brand list shows only the brands that sell in it.
//    (Saving checks the same rule on the server, so this is a convenience, not the only safeguard.)
(function () {
  'use strict';

  function whenReady(fn) {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', fn);
    } else {
      fn();
    }
  }

  // Every copy of jQuery on the page (there are two: the theme's and Django's).
  function jqueries() {
    var found = [];
    [window.jQuery, window.django && window.django.jQuery].forEach(function (jq) {
      if (jq && found.indexOf(jq) === -1) found.push(jq);
    });
    return found;
  }

  var TAGS = { required: 'Required', recommended: 'Recommended', optional: 'Optional' };
  var HELP = {
    '1': 'Category and name are needed. The brand list only offers brands that sell in the category you choose.',
    '2': 'One block for each version you sell, for example each colour. Leave Colour and Size empty if there are no options. ' +
         'At least one version is needed, or the product will not appear in the app.',
    '3': 'The first picture is the main one. Each picture needs a short description (alt text). ' +
         'Choose a colour only if the picture is for that colour.',
    '4': 'Facts shoppers look for, such as Connectivity or Battery life. Add as many as you like.'
  };

  // ---- 1. Section headings ----
  function decorateSections() {
    var form = document.getElementById('product_form');
    if (!form) return;

    var first = null;
    Array.prototype.forEach.call(form.querySelectorAll('.card > .card-header'), function (header) {
      var text = header.textContent.replace(/\s+/g, ' ').trim();
      var m = /^(?:(\d)\.\s*)?(.+?)\s*\((required|recommended|optional)\b[^)]*\)/i.exec(text);
      if (!m) return; // not one of our section headings (for example a version block)

      var number = m[1] || '';
      var kind = m[3].toLowerCase();
      var card = header.parentElement;
      card.classList.add('vm-section');
      card.classList.add(number ? 'vm-section-' + number : 'vm-extras');
      header.classList.add('vm-section-header');
      if (!first) first = card;

      header.innerHTML = '';
      var title = document.createElement('span');
      title.className = 'vm-title';
      title.textContent = (number ? number + '. ' : '') + m[2];
      var badge = document.createElement('span');
      badge.className = 'vm-badge vm-' + kind;
      badge.textContent = TAGS[kind];
      header.appendChild(title);
      header.appendChild(badge);

      if (number && HELP[number]) {
        var help = document.createElement('div');
        help.className = 'vm-help';
        help.textContent = HELP[number];
        card.insertBefore(help, header.nextSibling);
      }
    });

    if (first && first.parentNode) {
      var intro = document.createElement('div');
      intro.className = 'vm-intro';
      intro.textContent = 'Fill the numbered sections from top to bottom. Sections 1 and 2 are required. ' +
        'Everything on this page belongs to this one product and is saved together when you press Save.';
      first.parentNode.insertBefore(intro, first);
    }
  }

  // ---- 2. Block numbering and "Add another" links ----
  function tidyBlocks(groupId, word) {
    var group = document.getElementById(groupId);
    if (!group) return;

    var blocks = Array.prototype.filter.call(group.querySelectorAll('.inline-related'), function (block) {
      return !block.classList.contains('empty-form') && block.style.display !== 'none';
    });
    blocks.forEach(function (block, index) {
      var title = block.querySelector('.card-header .card-title');
      if (!title) return;
      var label = title.querySelector('.vm-block-title');
      if (!label) {
        label = document.createElement('span');
        label.className = 'vm-block-title';
        Array.prototype.forEach.call(title.childNodes, function (node) {
          if (node.nodeType === 3) node.textContent = ''; // drop the theme's "New Version #1" words
        });
        title.insertBefore(label, title.firstChild);
      }
      var wanted = word + ' ' + (index + 1);
      if (label.textContent !== wanted) label.textContent = wanted;
    });

    var add = group.querySelector('.add-row a');
    var addWanted = '+ Add another ' + word.toLowerCase();
    if (add && add.textContent.trim() !== addWanted) add.textContent = addWanted;
  }

  function hideEmptyPreviews() {
    Array.prototype.forEach.call(document.querySelectorAll('#images-group .field-preview'), function (row) {
      row.style.display = row.textContent.replace(/\s+/g, ' ').replace('Preview', '').trim() === '-' ? 'none' : '';
    });
  }

  function watchBlocks() {
    [['variants-group', 'Version'], ['images-group', 'Picture'], ['specifications-group', 'Specification']].forEach(function (pair) {
      var group = document.getElementById(pair[0]);
      if (!group) return;
      var run = function () { tidyBlocks(pair[0], pair[1]); hideEmptyPreviews(); };
      run();
      // rows are added and removed by the page; tidy up again each time (it changes nothing when already tidy)
      new MutationObserver(run).observe(group, { childList: true, subtree: true });
    });
  }

  // ---- 3. Extras: last on the page, folded shut unless it holds an error ----
  function setUpExtras() {
    var extras = document.querySelector('.card.vm-extras') || document.querySelector('.card.product-extras');
    if (!extras) return;

    var specs = document.getElementById('specifications-group');
    var lastCard = specs && specs.closest('.card');
    if (lastCard && lastCard.parentNode) {
      lastCard.parentNode.insertBefore(extras, lastCard.nextSibling);
    }

    var header = extras.querySelector(':scope > .card-header');
    var body = extras.querySelector(':scope > .card-body');
    if (!header || !body) return;

    var hasError = !!body.querySelector('.is-invalid, .errorlist') ||
      Array.prototype.some.call(body.querySelectorAll('.help-block.red'), function (el) {
        return el.textContent.trim() !== '';
      });

    var hint = document.createElement('span');
    hint.className = 'vm-hint';
    header.appendChild(hint);

    function setOpen(open) {
      body.style.display = open ? '' : 'none';
      hint.textContent = open ? 'click to close' : 'click to open';
    }

    header.style.cursor = 'pointer';
    header.addEventListener('click', function () { setOpen(body.style.display === 'none'); });
    setOpen(hasError);
  }

  whenReady(function () {
    decorateSections();
    watchBlocks();
    setUpExtras();
  });

  // ---- 4. Brand list follows the chosen category ----
  whenReady(function () {
    var category = document.getElementById('id_category');
    var brand = document.getElementById('id_brand');
    if (!category || !brand) return;

    var url = brand.getAttribute('data-brands-url');
    if (!url) return;

    var latestRequest = 0;

    function refreshBrands() {
      var current = brand.value;
      var thisRequest = ++latestRequest;

      fetch(url + '?category=' + encodeURIComponent(category.value || ''), { credentials: 'same-origin' })
        .then(function (response) { return response.json(); })
        .then(function (data) {
          if (thisRequest !== latestRequest) return; // an older answer arriving late is ignored

          var allowed = {};
          data.brands.forEach(function (b) { allowed[String(b.id)] = true; });

          while (brand.options.length) brand.remove(0);
          brand.add(new Option('---------', ''));
          data.brands.forEach(function (b) { brand.add(new Option(b.name, b.id)); });

          // keep the chosen brand if it is still allowed, otherwise clear it
          brand.value = allowed[current] ? current : '';

          // tell the styled dropdown that its options changed
          jqueries().forEach(function (jq) { jq(brand).trigger('change'); });
        })
        .catch(function () {
          // If the list cannot be loaded, leave every brand available: saving still checks the rule.
        });
    }

    category.addEventListener('change', refreshBrands);
    // The styled dropdown announces changes through jQuery, and this page has two separate copies of
    // jQuery (the theme's and Django's). Listen on both, or the change is never heard.
    jqueries().forEach(function (jq) { jq(category).on('change', refreshBrands); });

    refreshBrands();
  });
})();
