# Sistema de diseño UI — GestPyme

**Estado:** directriz visual predeterminada del proyecto  
**Alcance:** toda interfaz web nueva o existente y cualquier código HTML, CSS, JavaScript o framework de frontend que la implemente.

GestPyme adopta un lenguaje visual inspirado en Apple Human Interface Guidelines: sobrio, espacioso, nítido y centrado en el contenido. No se busca imitar pantallas de Apple, sino mantener una experiencia coherente, accesible y útil para pequeñas empresas.

## Principios obligatorios

1. **Un solo color de acción:** Action Blue `#0066cc` para enlaces, acciones principales, foco y estados activos. Los colores semánticos se reservan para estados reales (error, éxito y advertencia), nunca para decoración o una segunda marca.
2. **Acciones en forma de píldora:** botones principales, búsqueda y filtros interactivos usan extremos totalmente redondeados. Los botones secundarios pueden ser discretos, pero no compiten con la acción primaria.
3. **Sin sombras de interfaz:** no aplicar sombras a tarjetas, botones, paneles, menús ni texto. Separar niveles con superficies, espacio y líneas finas. La única excepción es una sombra muy suave bajo una imagen destacada cuando aporte profundidad real.
4. **Escala de peso tipográfico:** solo `400`, `600` y `700`. `500` está prohibido. Texto normal `400`, etiquetas/énfasis `600`, titulares `700`.
5. **Líneas finas:** separadores de `1px` con tokens `hairline` o `divider-soft`; evitar bordes gruesos. Una indicación de foco/selección accesible puede destacar el control sin engrosar toda la interfaz.
6. **Esquinas coherentes:** usar únicamente radios del sistema. En CSS, aproximar el efecto de curvas continuas con radios consistentes; no inventar un radio distinto para cada componente.
7. **Aire y jerarquía:** márgenes generosos y gutters responsivos; nada debe quedar pegado al borde. Los títulos de página son visibles y dominantes, sin sacrificar densidad legible en tablas de gestión.
8. **Superficies antes que adornos:** para jerarquizar, ajustar primero espacio, peso o superficie; no añadir sombras, colores de marca adicionales ni ornamentos.
9. **Movimiento discreto:** transiciones de `150–240ms` con easing de salida. La interacción presionada puede escalar a `0.95`; no usar rebotes llamativos. Respetar `prefers-reduced-motion`.
10. **Accesibilidad y claridad funcional:** conservar estados de foco visibles, contraste suficiente, etiquetas comprensibles, navegación por teclado y feedback textual. La estética no puede ocultar el estado de inventario, ventas o formularios.

## Tokens CSS

Declarar y reutilizar variables; no introducir valores hex, radios, espacios o grosores ad hoc en componentes. Si aparece una necesidad nueva, actualizar primero esta escala.

```css
:root {
  color-scheme: light;

  /* Acción y texto */
  --color-primary: #0066cc;
  --color-text: #1d1d1f;
  --color-text-secondary: #6e6e73;
  --color-text-tertiary: #86868b;

  /* Superficies */
  --color-surface: #ffffff;
  --color-surface-subtle: #f5f5f7;
  --color-surface-raised: #fbfbfd;

  /* Líneas */
  --color-hairline: #e0e0e0;
  --color-divider-soft: #f0f0f0;

  /* Solo para comunicar estados reales */
  --color-danger: #c62828;
  --color-success: #188038;
  --color-warning: #9a6700;

  /* Espaciado: múltiplos de 4px */
  --space-1: 4px;
  --space-2: 8px;
  --space-3: 12px;
  --space-4: 16px;
  --space-5: 20px;
  --space-6: 24px;
  --space-8: 32px;
  --space-10: 40px;
  --space-12: 48px;
  --page-gutter: clamp(20px, 4vw, 40px);

  /* Radios */
  --radius-control: 12px;
  --radius-card: 16px;
  --radius-panel: 24px;
  --radius-pill: 9999px;

  /* Tipografía */
  --font-ui: -apple-system, BlinkMacSystemFont, "SF Pro Text", "SF Pro Display",
    Inter, "Segoe UI", sans-serif;
  --weight-regular: 400;
  --weight-semibold: 600;
  --weight-bold: 700;

  /* Movimiento */
  --duration-fast: 150ms;
  --duration-standard: 200ms;
  --duration-gentle: 240ms;
  --ease-out: cubic-bezier(0.2, 0.7, 0.3, 1);
}
```

### Uso de tokens

- Aplicar `var(--color-primary)` a acciones, enlaces, selección activa y anillo de foco; no usar azul como relleno decorativo de paneles.
- `--color-surface-subtle` y `--color-surface-raised` permiten jerarquizar bloques sin sombras.
- Para separadores usar `1px solid var(--color-hairline)` o `var(--color-divider-soft)`.
- Mantener tipografía del sistema y una escala breve y jerárquica. Los titulares grandes llevan tracking ligeramente negativo; evitar exceso de estilos y familias.
- Gutter de página: `var(--page-gutter)`; los espacios internos deben provenir de la escala `--space-*`.
- En modo oscuro, si se incorpora, definir una paleta semántica completa mediante tokens y probar contraste; no invertir colores mecánicamente ni crear acentos nuevos.

## Recetas de componentes

- **Botón primario:** fondo Action Blue, texto blanco, peso `600`, radio `--radius-pill`, altura cómoda de toque. Hover/focus/pressed deben ser distinguibles y accesibles; sin sombra.
- **Botón secundario:** superficie neutral o transparente, texto legible, sin competir visualmente con el primario; usar línea fina solo si aclara el límite.
- **Búsqueda y filtros:** forma de píldora, fondo neutral, etiqueta/placeholder explícitos; no depender exclusivamente del placeholder.
- **Tarjetas y paneles:** usar separación por superficie, padding generoso y esquinas del sistema. Evitar bordes fuertes y sombras de elevación.
- **Tablas y métricas:** priorizar legibilidad y alineación; divisores finos, títulos descriptivos, cifras fáciles de comparar. El color de estado solo aparece cuando indica una condición real (p. ej. stock bajo).
- **Alertas y diálogos:** mensajes propios, sobrios y específicos; confirmación centrada para decisiones importantes y hoja inferior para menús en pantallas pequeñas. No depender de diálogos nativos genéricos si se necesita coherencia visual.

## Movimiento y estados

```css
.interactive {
  transition:
    color var(--duration-standard) var(--ease-out),
    background-color var(--duration-standard) var(--ease-out),
    transform var(--duration-fast) var(--ease-out);
}

.interactive:active {
  transform: scale(0.95);
}

:focus-visible {
  outline: 2px solid var(--color-primary);
  outline-offset: 2px;
}

@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after {
    scroll-behavior: auto !important;
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
  }
}
```

Aplicar la transformación de presión solo a controles interactivos apropiados; no a elementos estáticos ni a controles cuyo movimiento perjudique la lectura.

## Lista de revisión antes de entregar UI

- [ ] ¿Se usa un único acento interactivo, `#0066cc`?
- [ ] ¿Las acciones primarias, búsquedas y filtros tienen tratamiento de píldora?
- [ ] ¿Se eliminaron sombras de controles, tarjetas, paneles y texto?
- [ ] ¿Los pesos tipográficos son exclusivamente `400`, `600` y `700`?
- [ ] ¿Los separadores son líneas finas y los radios pertenecen a la escala?
- [ ] ¿Hay suficiente espacio y padding en todos los tamaños de pantalla?
- [ ] ¿La interfaz diferencia estados con texto/íconos además del color?
- [ ] ¿Foco, teclado, contraste, movimiento reducido y áreas de toque están cubiertos?
- [ ] ¿Se reutilizan tokens en lugar de valores sueltos?
- [ ] ¿La jerarquía mejora el trabajo real de la Pyme y no añade decoración innecesaria?

## Regla de precedencia

Estas directrices son el valor predeterminado de GestPyme para toda UI. Una instrucción explícita del usuario para una pantalla concreta puede ajustar el diseño de esa pantalla; los requisitos de accesibilidad, legibilidad y seguridad de la información siguen vigentes.
