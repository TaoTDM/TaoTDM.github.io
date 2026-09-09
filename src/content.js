/* site text */

export const NAME = 'Shi-Tao Chang';
export const TAGLINE = ['Geo AI @ UT', 'GISense Lab'];
export const LINKS = {
  ut: 'https://www.utexas.edu/',
  lab: 'https://sites.utexas.edu/gisense/'
};

/* email joined at runtime */
export const EMAIL = ['tao', 'taotdm.com'].join('@');

/* settings spark */
export const SETTINGS = {
  id: 'settings',
  label: 'theme settings',
  children: [
    { label: 'choose theme', action: 'toggle-theme' },
    { label: 'sound', action: 'toggle-sound' }
  ]
};

/* content tree */
export const TREE = [
  {
    id: 'about',
    label: 'about',
    children: [
      { label: 'geo ai research at GISense Lab, UT Austin', href: LINKS.lab },
      { label: 'spatial data science, neuro ai, human-centered geography' }
    ]
  },
  {
    id: 'papers',
    label: 'select papers',
    children: [
      { label: 'forthcoming', meta: '2026' }
    ]
  },
  {
    id: 'research',
    label: 'research',
    children: [
      {
        label: 'research assistant, GISense Lab',
        meta: 'mar 2026 to present',
        children: [
          { label: 'reproduced and fine-tuned baseline models to generate landscapes from sound.' },
          { label: 'developed and evaluated raw video and EEG/MEG/fMRI datasets.' },
          { label: 'currently engineering multimodal brain-to-image models for human-centered applications.' }
        ]
      }
    ]
  },
  {
    id: 'campus',
    label: 'campus',
    children: [
      { label: 'ut austin, computer science, class of 2029' },
      {
        label: 'organizations',
        children: [
          { label: 'DiRP, member since aug 2025, administrator since apr 2026. sponsorship and fundraising outreach to corporate partners.' },
          { label: 'TX Luminescence, backend/ml engineer' },
          { label: 'ULS, member' },
          { label: 'Longhorn Urbanists, member' }
        ]
      },
      {
        label: 'honors',
        children: [
          { label: 'undergraduate research apprenticeship program', meta: 'fall 2026', href: 'https://liberalarts.utexas.edu/students/undergraduate-research-archive/undergraduate-research-apprenticeship-program.html' },
          { label: 'summer research scholar', meta: 'summer 2026', href: 'https://undergraduates.utexas.edu/academics/undergraduate-research/conducting-research/summer-research-scholars-programs' },
          { label: 'research assistantship, GISense Lab', meta: 'summer 2026' },
          { label: 'university honors', meta: '2025' }
        ]
      },
      {
        label: 'coursework',
        children: [
          { label: 'machine learning for text analysis' },
          { label: 'data structures' },
          { label: 'discrete math' }
        ]
      }
    ]
  },
  {
    id: 'contact',
    label: 'elsewhere',
    children: [
      { label: 'email', action: 'copy-email' },
      { label: 'github', href: 'https://github.com/TaoTDM' },
      { label: 'linkedin', href: 'https://www.linkedin.com/in/shi-tao-chang/' }
    ]
  }
];
