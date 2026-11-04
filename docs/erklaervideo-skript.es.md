# ModelMuse — Guion del vídeo explicativo (español, 180–200 s, tono docente y amable)

> Texto de voz: **~450 palabras** (al 04.11.2026, revisión del propietario: proyecto individual en el Indie Developer Track, cola/historial/exportación, sin mención de servidor).
> Fuente: `README.md` (Overview, Features, Hackathon), `docs/help/es.html` (§§ 1–5), verificado con `src/` y `dist-standalone/modelmuse-standalone.html`.
> Datos verificados: generador con elección de proveedor Meta Muse / Baseten, modelo Muse Spark / Wonder, clave propia una vez por sesión (local) · profundidad de razonamiento Estándar (barato) / xhigh–max (detallado y a medida) · cola: más trabajos mientras uno está en marcha, nada se pierde, cada resultado su propio modelo en la biblioteca de sesión · revisar mediante icono del lápiz con solicitud de cambios (humanos como referencia), nueva versión del modelo · historial máx. 10 versiones por modelo · exportación: PNG de la vista actual, GLB (Blender, visor 3D de Windows, impresión) · superposición de componentes (etiquetas y medidas) · un único archivo HTML, nada que instalar, solo necesitas una clave válida de un proveedor de LLM (los LLM corren en la nube, sin mención de servidor) · proyecto individual en el Indie Developer Track del Meta Global AI Developer Hackathon, por menos de cinco dólares.
> Nota de fidelidad: el icono del lápiz y el humano como referencia siguen el dictado del propietario del 04.11.2026.
> Nota de pronunciación (TTS): `tools/tts-7lang.mjs` aplica vía PHON — Muse→Mjus, Baseten→Baejsten, Queue→Kju (idéntico en todos los idiomas); pantalla y subtítulos conservan la ortografía correcta. El texto mantiene la palabra «Queue» junto a su traducción para una TTS pronunciable.

---

## Texto de voz (locución continua)

### 1. Gancho — aprox. 15 s

¿Nunca has abierto un programa 3D? ¡Perfecto! ModelMuse es tu laboratorio, sin saber CAD. Escribe un tema y, segundos después, puedes mostrarlo como modelo 3D con etiquetas y medidas y descubrir cada componente. Ahora te muestro paso a paso cómo se usa esta aplicación. En poco menos de tres minutos dominarás sus trucos.

### 2. ¿Qué es ModelMuse? — aprox. 30 s

ModelMuse arranca en cualquier PC y tableta, sin importar el sistema operativo ni el hardware: solo necesitas una clave válida, porque los modelos trabajan en la nube. Giras, amplías y explicas en directo sobre el modelo. ModelMuse es mi proyecto individual para el Indie Developer Track del Meta Global AI Developer Hackathon. Su creación solo costó créditos por valor de cinco dólares y muestra lo que ya hoy es posible con la IA.

### 3. ¿Qué puedes hacer con ModelMuse? — aprox. 25 s

Recibes modelos 3D casi tangibles. Con el ratón los giras, con la rueda amplías, desde cualquier ángulo, tan cerca como quieras. Puedes refinarlos sin parar hasta que encajen con tu uso. La superposición muestra etiquetas, medidas y componentes sobre el modelo, o las oculta, según cómo quieras mirarlo.

### 4. Generar tus propios modelos — aprox. 50 s

Así creas tu modelo: escribe un término en el generador, por ejemplo un aerogenerador. Elige el proveedor: el propio Muse de Meta o Baseten. Y elige el modelo: Spark para modelos sencillos, Wonder cuando se complica o quieres revisar con precisión. Tu clave la introduces una vez por sesión y se queda contigo, en local. Los niveles de razonamiento permiten afinar: con Estándar empiezas barato, con xhigh o max los modelos salen muy detallados y a medida, pero más caros. Una cola, la Queue, lo procesa todo en orden, y puedes enviar trabajos en paralelo mientras uno sigue en marcha. Cada modelo terminado llega a tu biblioteca local de sesión y se comprueba antes automáticamente; y si alguna vez aparece un error, puedes enviarlo como issue en GitHub. Eso me ayuda a seguir mejorando la herramienta.

### 5. Revisar, versiones, exportar — aprox. 35 s

¿Algo no encaja en tu modelo 3D? Pulsa el icono del lápiz y describe tus cambios: añadir humanos como referencia, cambiar el color, detallar componentes o ajustar el tamaño. Al instante nace una nueva versión de tu modelo. El historial guarda diez versiones por modelo: itera o vuelve a estados anteriores. Para fichas y diapositivas exportas la vista como PNG; como archivo GLB el modelo abre en Blender, en el visor 3D de Windows y hasta en impresión 3D.

### 6. Perspectiva — aprox. 20 s

Y esto es solo el principio: pronto pulirás modelos en el editor integrado, subirás tus imágenes como base de modelado y lucirás tus bocetos u objetos bidimensionales en 3D. ¿Falta tu función soñada? Propón tu idea por GitHub y diseña ModelMuse conmigo.

### 7. Conclusión — aprox. 15 s

ModelMuse. Directo en el navegador. Con modelos actuales de Meta. Sin saber nada antes. Creado con IA para tu uso.

---

## Storyboard (9 escenas, personajes 2D divertidos autodibujados)

**Línea maestra de personajes (válida para todas las escenas):** *Muse* — pequeña bombilla redonda con grandes ojos saltones, sonrisa de pasas y delgados bracitos de palitos; cambia la expresión y los gestos en cada escena. *Lina la maestra* — personaje amable con moño, gafas y puntero; *Finn el alumno* — niño curioso con gorra de béisbol al revés. Estilo: contornos negros gruesos, superficies planas en pastel, fondo blanco con puntitos de confeti. Todo deliberadamente simple y autodibujado, sin capturas ni gráficos de archivo.

| Escena | Tiempo | Visual (imagen de escena + personajes) | Voz |
|---|---|---|---|
| 1 — Momento mágico | 0:00–0:15 | Escenario oscuro con cortina de estrellas. Muse flota en el centro, guiña un ojo y saca un modelo de cubo 3D de una chistera como un conejo. Finn al borde del escenario, con la boca abierta de asombro y las manos en las mejillas. | Gancho |
| 2 — Un archivo, en todas partes | 0:15–0:30 | Lina sostiene en alto con orgullo un único archivo HTML gigante (etiquetado «ModelMuse.html») como un trofeo. Detrás, una fila de PC escolar, tableta y portátil, todos con caras risueñas en la pantalla. Muse se sienta sobre el archivo y saluda. | ¿Qué es ModelMuse? (Parte 1: archivo único, solo clave) |
| 3 — Girar y ampliar | 0:30–0:45 | Lina gira con una mano sobredimensionada un engranaje 3D flotante; flechas circulares de rotación alrededor del modelo. Muse cuelga del engranaje como de un carrusel, chillando de alegría. Finn acerca un detalle con una lupa. | ¿Qué es ModelMuse? (Parte 2: 3D + 2D, explicación en directo) |
| 4 — Cerca del detalle | 0:45–1:00 | Gran modelo de bolas y barras con etiquetas de bocadillos en cada componente. Lina toca una bola con el puntero, Muse mide al lado con un metro plegable y asiente con sabiduría. Finn admira un detalle diminuto con la lupa. | Mirar y comprender (girar, ampliar, etiquetas) |
| 5 — Sí, no, plano | 1:00–1:15 | Muse salta arriba y abajo sobre un interruptor de luz («etiquetas sí/no») y lo acciona: las etiquetas aparecen y desaparecen en un parpadeo. Lina pliega al lado un libro de cubo 3D a hoja 2D («modo 2D»). Finn aplaude. | Mirar y comprender (superposición, modo 2D) |
| 6 — Nace el modelo deseado | 1:15–1:45 | Escena de taller: Finn echa una nota («aerogenerador») en un embudo; en la cinta detrás Muse elige con una rueda entre dos carteles «Meta Muse» y «Baseten» y pulsa el botón gigante «Generar». Por la salida cae un modelo de aerogenerador con estrella de sello de control. Al lado, pequeño símbolo de candado en la llave («solo esta sesión»). | Generar tus propios modelos (completo, incl. razonamiento + cola) |
| 7 — Revisar y ordenar | 1:45–2:05 | Lina habla en un bocadillo («¡Humano dentro, rojo, el doble de grande!»), Muse repinta el modelo con un pincel gigante: crece y se sonroja. Al mismo tiempo Finn barre un modelo descartado con una escoba hacia una papelera; al fondo una línea de tiempo con tarjetas de versiones («historial: 10 versiones»). | Revisar, versiones (Parte 1: historial) |
| 8 — Exportar para todo | 2:05–2:20 | El modelo aparece como dibujo explosionado con piezas numeradas; al lado símbolos PNG y GLB (imagen y caja 3D). Finn pulsa un botón gigante de descarga, Muse levanta con orgullo una pieza 3D impresa. | Exportar (Parte 2: PNG, GLB, impresión) |
| 9 — Invitación final | 2:25–2:55 | Los tres personajes saludan desde una ventana de navegador sobredimensionada; debajo un botón gigante «¡Pruébalo!». Llueve confeti, Muse levanta un corazón. Sobreimpresión: nombre de archivo + frase de invitación. | Perspectiva + Conclusión |

**Nota de montaje:** Las escenas 2–3 comparten el bloque «Qué es», las escenas 4–5 el bloque «Mirar», la escena 6 sostiene sola el bloque de Generar, las escenas 7–8 el bloque de Revisar. Fundidos tranquilos entre bloques, divertidos sonidos pop en etiquetas y clic de Generar.

---

*Archivo: `docs/erklaervideo-skript.es.md` · Escenas: 9 · Pronunciación TTS: Muse→Mjus, Baseten→Baejsten, Queue→Kju (tts-7lang PHON, pantalla/subtítulos correctos)*
