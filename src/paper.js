/* print page */

export function buildPaper(root, { name, tagline, tree, email }) {
  const h1 = document.createElement('h1');
  h1.textContent = name;
  const tag = document.createElement('p');
  tag.className = 'tag';
  tag.textContent = tagline.join(', ');
  root.append(h1, tag);

  const item = (node) => {
    const li = document.createElement('li');
    if (node.href) {
      const a = document.createElement('a');
      a.href = node.href;
      a.textContent = node.label;
      li.appendChild(a);
    } else if (node.action === 'copy-email') {
      li.textContent = email;
    } else {
      li.textContent = node.label;
    }
    if (node.meta) {
      const m = document.createElement('span');
      m.className = 'meta';
      m.textContent = node.meta;
      li.appendChild(m);
    }
    if (node.children) {
      const ul = document.createElement('ul');
      node.children.forEach(c => ul.appendChild(item(c)));
      li.appendChild(ul);
    }
    return li;
  };

  for (const section of tree) {
    const h2 = document.createElement('h2');
    h2.textContent = section.label;
    const ul = document.createElement('ul');
    (section.children || []).forEach(c => ul.appendChild(item(c)));
    root.append(h2, ul);
  }
}
