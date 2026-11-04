# ModelMuse — Script de la vidéo explicative (français, 180–200 s, ton pédagogique et convivial)

> Texte voix off : **~475 mots** (au 04.11.2026, révision du propriétaire : projet solo dans l'Indie Developer Track, file d'attente/historique/export, sans mention de serveur).
> Source : `README.md` (Overview, Features, Hackathon), `docs/help/fr.html` (§§ 1–5), vérifié avec `src/` et `dist-standalone/modelmuse-standalone.html`.
> Faits vérifiés : générateur avec choix du fournisseur Meta Muse / Baseten, modèle Muse Spark / Wonder, clé personnelle une fois par session (local) · profondeur de raisonnement Standard (économique) / xhigh–max (détaillé et fidèle aux mesures) · file d'attente : d'autres travaux pendant qu'un tourne, rien ne se perd, chaque résultat son propre modèle dans la bibliothèque de session · révision via icône crayon avec demande de modification (humains comme référence), nouvelle version du modèle · historique max. 10 versions par modèle · export : PNG de la vue actuelle, GLB (Blender, visionneuse 3D Windows, impression) · superposition des composants (légendes et mesures) · un seul fichier HTML, rien à installer, juste une clé valide d'un fournisseur de LLM (les LLM tournent dans le cloud — sans mention de serveur) · projet solo dans l'Indie Developer Track du Meta Global AI Developer Hackathon, pour moins de cinq dollars.
> Note de fidélité : l'icône crayon et l'humain comme référence suivent la consigne du propriétaire du 04.11.2026.
> Note de prononciation (TTS) : `tools/tts-7lang.mjs` applique via PHON — Muse→Mjus, Baseten→Baejsten, Queue→Kju (identique dans toutes les langues) ; affichage et sous-titres gardent l'orthographe correcte. La voix off garde le mot « Queue » à côté de sa traduction pour une TTS prononçable.

---

## Texte voix off (continu)

### 1. Accroche — env. 15 s

Jamais ouvert un logiciel 3D ? Parfait ! ModelMuse est ton labo, sans CAO ! Tape un sujet et, quelques secondes plus tard, tu l'affiches comme modèle 3D avec légendes et mesures et tu découvres chaque composant. Je te montre maintenant, étape par étape, comment utiliser cette application. En un peu moins de trois minutes, tu en maîtriseras les astuces.

### 2. Qu'est-ce que ModelMuse ? — env. 30 s

ModelMuse démarre sur chaque PC et tablette, quels que soient le système et le matériel : il te faut juste une clé valide, car les modèles travaillent dans le cloud. Tu tournes, tu zoomes, tu expliques en direct sur le modèle. ModelMuse est mon projet solo pour l'Indie Developer Track du Meta Global AI Developer Hackathon. Sa création n'a coûté que cinq dollars de crédits et montre ce que l'IA rend déjà possible aujourd'hui.

### 3. Que peux-tu faire avec ModelMuse ? — env. 25 s

Tu obtiens des modèles 3D presque tangibles. À la souris tu les fais pivoter, à la molette tu zoomes, sous tous les angles, d'aussi près que tu veux. Tu peux les affiner sans cesse jusqu'à ton usage exact. La superposition affiche légendes, mesures et composants sur le modèle — ou les masque, selon ton regard.

### 4. Générer tes propres modèles — env. 50 s

Voici comment créer ton modèle : entre un terme dans le générateur, par exemple une éolienne. Choisis le fournisseur : le Muse de Meta ou Baseten. Puis le modèle : Spark pour les modèles simples, Wonder quand ça se complique ou pour réviser avec précision. Ta clé se saisit une fois par session et reste chez toi, en local. Les niveaux de raisonnement règlent la finesse : Standard démarre à petit prix, tandis que xhigh ou max rendent les modèles très détaillés et fidèles aux mesures — mais plus chers. Une file d'attente, la Queue, traite tout à la suite, et tu peux envoyer d'autres travaux en parallèle pendant qu'un tourne. Chaque modèle fini rejoint ta bibliothèque locale de session et est vérifié d'abord automatiquement ; et si un message d'erreur survient, envoie-le comme issue sur GitHub. Cela m'aide à faire évoluer l'outil.

### 5. Réviser, versions, exporter — env. 35 s

Quelque chose cloche dans ton modèle 3D ? Clique l'icône crayon et décris tes modifications : ajouter des humains comme référence, changer la couleur, détailler les composants ou ajuster la taille. Une nouvelle version naît aussitôt. L'historique garde dix versions par modèle : itère ou reviens aux états précédents. Pour fiches et diapos, tu exportes la vue en PNG ; en fichier GLB, le modèle s'ouvre dans Blender, la visionneuse 3D Windows et même l'impression 3D.

### 6. Perspectives — env. 20 s

Et ce n'est que le début : bientôt tu poliras les modèles dans l'éditeur intégré, tu chargeras tes images comme base de modélisation et tu sublimeras tes croquis ou objets bidimensionnels en 3D. Il manque ta fonction rêvée ? Propose ton idée via GitHub et façonne ModelMuse avec moi.

### 7. Conclusion — env. 15 s

ModelMuse. Direct dans le navigateur. Avec les modèles actuels de Meta. Zéro prérequis. Créé avec l'IA pour ton usage.

---

## Storyboard (9 scènes, personnages 2D amusants dessinés à la main)

**Ligne des personnages (valable pour toutes les scènes) :** *Muse* — petite ampoule ronde avec de grands yeux globuleux, sourire en grain de raisin et petits bras en bâtons ; change d'expression et de gestes à chaque scène. *Lina la maîtresse* — personnage amical avec chignon, lunettes et baguette ; *Finn l'élève* — garçon curieux avec casquette de baseball à l'envers. Style : contours noirs épais, aplats pastel, fond blanc avec confettis. Le tout délibérément simple et dessiné à la main, sans captures ni images d'archives.

| Scène | Temps | Visuel (décor + personnages) | Voix off |
|---|---|---|---|
| 1 — Moment magique | 0:00–0:15 | Scène sombre avec rideau d'étoiles. Muse flotte au centre, fait un clin d'œil et sort un modèle cube 3D d'un chapeau comme un lapin. Finn au bord de la scène, bouche ouverte d'étonnement, mains sur les joues. | Accroche |
| 2 — Un fichier, partout | 0:15–0:30 | Lina brandit fièrement un unique et immense fichier HTML (inscrit « ModelMuse.html ») comme un trophée. Derrière, rangée de PC d'école, tablette et portable, tous avec visages souriants sur l'écran. Muse assise sur le fichier fait coucou. | Qu'est-ce que ModelMuse ? (partie 1 : fichier unique, juste une clé) |
| 3 — Tourner et zoomer | 0:30–0:45 | Lina tourne un engrenage 3D flottant avec une main surdimensionnée ; flèches circulaires autour du modèle. Muse accrochée à l'engrenage comme à un manège, criant de joie. Finn zoome un détail avec une loupe. | Qu'est-ce que ModelMuse ? (partie 2 : 3D + 2D, expliquer en direct) |
| 4 — Gros plan sur les détails | 0:45–1:00 | Grand modèle boules-bâtonnets avec bulles de légende sur chaque composant. Lina pointe une boule avec sa baguette, Muse mesure à côté avec un mètre pliant et hoche la tête d'un air savant. Finn admire un détail minuscule à la loupe. | Regarder et comprendre (tourner, zoomer, légendes) |
| 5 — On, off, à plat | 1:00–1:15 | Muse saute sur un interrupteur (« légendes on/off ») et actionne : les étiquettes apparaissent et disparaissent en un clin d'œil. Lina plie à côté un livre du cube 3D vers la feuille 2D (« mode 2D »). Finn applaudit. | Regarder et comprendre (superposition, mode 2D) |
| 6 — Le modèle souhaité naît | 1:15–1:45 | Scène d'atelier : Finn jette un papier (« éolienne ») dans un entonnoir ; sur la chaîne derrière, Muse choisit avec une roue entre deux pancartes « Meta Muse » et « Baseten » et appuie sur le bouton géant « Générer ». Un modèle d'éolienne tombe avec étoile de contrôle. Petit cadenas à côté de la clé (« session uniquement »). | Générer tes propres modèles (complet, incl. raisonnement + file d'attente) |
| 7 — Réviser et ranger | 1:45–2:05 | Lina parle dans une bulle (« Humain dedans, rouge, deux fois plus grand ! »), Muse repeint le modèle au pinceau géant — il grandit et rougit. Finn balaie en même temps un modèle trié vers une poubelle ; en arrière-plan une frise avec des cartes de versions (« historique : 10 versions »). | Réviser, versions (partie 1 : historique) |
| 8 — Exporter pour tous les cas | 2:05–2:20 | Le modèle en vue éclatée avec pièces numérotées ; à côté symboles PNG et GLB (image et boîte 3D). Finn clique sur un bouton de téléchargement géant, Muse brandit fièrement une pièce 3D imprimée. | Exporter (partie 2 : PNG, GLB, impression) |
| 9 — Invitation finale | 2:25–2:55 | Les trois personnages font coucou depuis une fenêtre de navigateur surdimensionnée ; en dessous un bouton géant « Essaie ! ». Pluie de confettis, Muse tient un cœur. Nom de fichier + phrase d'invitation. | Perspectives + Conclusion |

**Note de montage :** les scènes 2–3 partagent le bloc « Qu'est-ce que », les scènes 4–5 le bloc « Regarder », la scène 6 porte seule le bloc « Générer », les scènes 7–8 le bloc « Réviser ». Fondus calmes entre les blocs, petits pops ludiques sur les étiquettes et le clic Générer.

---

*Fichier : `docs/erklaervideo-skript.fr.md` · Scènes : 9 · Prononciation TTS : Muse→Mjus, Baseten→Baejsten, Queue→Kju (tts-7lang PHON, affichage/sous-titres corrects)*
