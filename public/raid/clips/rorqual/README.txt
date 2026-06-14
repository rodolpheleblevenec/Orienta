Boss RAID « rorqual » — médias pré-rendus (hors WebGL, fiables sur tous les appareils)
=====================================================================================

Dépose ici les fichiers suivants (les noms doivent être EXACTS) :

1) poster.webp   ← INDISPENSABLE (le boss s'affiche dès que ce fichier est là)
   - Une image PLEIN CADRE du rorqual (boss + fond), au format paysage.
   - Le plus simple : ouvre orca.glb dans « Visionneuse 3D » (Windows), cadre le
     boss, fais une capture, exporte en .webp (ou .png/.jpg → renomme en .webp,
     ou convertis). Ratio large conseillé (~16:9). Affiché en "cover".

2) idle.mp4      ← optionnel (rend le boss VIVANT, en boucle)
   - Courte boucle (4–8 s) du boss qui « nage »/respire, muette, H.264.
   - Capture d'écran vidéo de la Visionneuse 3D pendant l'animation, par ex.

3) attack.mp4    ← optionnel (joué une fois quand le boss contre-attaque)

Après avoir déposé poster.webp, le boss apparaît tout de suite (rafraîchis la page).
Pour activer idle.mp4 / attack.mp4 : dé-commente les lignes correspondantes dans
src/lib/raidClips.js (entrée « rorqual »).
