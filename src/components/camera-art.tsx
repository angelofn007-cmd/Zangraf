/**
 * Câmera instantânea animada (decorativa): aperta o botão, dispara o flash
 * e uma foto sai por baixo e se revela. A faixa usa as cinco cores do logo.
 */
export function CameraArt() {
  return <div className="zg-camera" aria-hidden="true">
    <svg viewBox="0 0 200 200" role="presentation">
      <defs>
        <radialGradient id="zg-camera-glass" cx="38%" cy="34%" r="70%">
          <stop offset="0" stopColor="#6f8fae"/>
          <stop offset=".45" stopColor="#25324a"/>
          <stop offset="1" stopColor="#0d0f14"/>
        </radialGradient>
        <linearGradient id="zg-camera-photo" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#f3c98f"/>
          <stop offset=".55" stopColor="#d98b6a"/>
          <stop offset="1" stopColor="#7d9c6e"/>
        </linearGradient>
      </defs>
      <ellipse className="zg-camera-shadow" cx="100" cy="186" rx="62" ry="7"/>
      <g className="zg-camera-body">
        {/* Foto que sai pela fresta de baixo (desenhada antes, fica escondida atrás do corpo) */}
        <g className="zg-camera-print">
          <rect x="56" y="78" width="88" height="80" rx="3" fill="#fffdf8"/>
          <rect className="zg-camera-photo" x="63" y="85" width="74" height="56" rx="1.5" fill="url(#zg-camera-photo)"/>
          <circle className="zg-camera-photo" cx="86" cy="104" r="7" fill="#fff6d8"/>
          <path className="zg-camera-photo" d="M63 141l22-20 14 12 12-9 26 17z" fill="#5a6b4c"/>
        </g>
        <rect className="zg-camera-shutter" x="48" y="30" width="20" height="9" rx="3.5" fill="#fdf153"/>
        <rect x="44" y="36" width="44" height="16" rx="6" fill="#2c2d27"/>
        <rect x="28" y="44" width="144" height="98" rx="20" fill="#2c2d27"/>
        <rect x="34" y="50" width="132" height="86" rx="15" fill="none" stroke="#ffffff14" strokeWidth="2"/>
        {/* Faixa com as cinco cores do logo */}
        <g>
          <rect x="28" y="64" width="28.8" height="7" fill="#e8221e"/>
          <rect x="56.8" y="64" width="28.8" height="7" fill="#19b33a"/>
          <rect x="85.6" y="64" width="28.8" height="7" fill="#f5e21a"/>
          <rect x="114.4" y="64" width="28.8" height="7" fill="#1aa8e8"/>
          <rect x="143.2" y="64" width="28.8" height="7" fill="#e81aa5"/>
        </g>
        <rect x="56" y="50" width="18" height="10" rx="2.5" fill="#15150f"/>
        <rect x="126" y="50" width="30" height="12" rx="3" fill="#f5f1e6"/>
        <circle className="zg-camera-flash" cx="141" cy="56" r="6" fill="#fff"/>
        {/* Lente */}
        <circle cx="100" cy="98" r="33" fill="#1b1b18" stroke="#3d3e36" strokeWidth="5"/>
        <circle className="zg-camera-ring" cx="100" cy="98" r="27" fill="none" stroke="#6b6c5f" strokeWidth="2" strokeDasharray="3 5"/>
        <circle cx="100" cy="98" r="21" fill="url(#zg-camera-glass)"/>
        <circle className="zg-camera-iris" cx="100" cy="98" r="8" fill="#07080b"/>
        <ellipse cx="91" cy="89" rx="6" ry="3.5" fill="#fff" opacity=".55" transform="rotate(-30 91 89)"/>
        <circle cx="111" cy="108" r="2" fill="#fff" opacity=".3"/>
        <rect x="62" y="136" width="76" height="4" rx="2" fill="#15150f"/>
      </g>
      <g className="zg-camera-sparkles" fill="#f5e21a">
        <path d="M30 26l2.2 5.8L38 34l-5.8 2.2L30 42l-2.2-5.8L22 34l5.8-2.2z"/>
        <path d="M176 22l1.6 4.2 4.4 1.8-4.4 1.6L176 34l-1.6-4.4-4.4-1.6 4.4-1.8z" fill="#1aa8e8"/>
        <path d="M184 128l1.4 3.6 3.6 1.4-3.6 1.4-1.4 3.6-1.4-3.6-3.6-1.4 3.6-1.4z" fill="#e81aa5"/>
      </g>
    </svg>
  </div>;
}
