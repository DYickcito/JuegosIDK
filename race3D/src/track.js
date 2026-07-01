import * as THREE from 'three';

export class Track {
  constructor(scene) {
    this.scene = scene;
    this.roadWidth = 32;
    this.segments = 300;

    // Spline de pista plano (coordenadas escaladas por 1.4 para hacer la carrera más extensa)
    const scale = 1.4;
    const points = [
      new THREE.Vector3(0, 0.05, 0),
      new THREE.Vector3(0, 0.05, -120 * scale),
      new THREE.Vector3(80 * scale, 0.05, -220 * scale),
      new THREE.Vector3(220 * scale, 0.05, -260 * scale),
      new THREE.Vector3(340 * scale, 0.05, -180 * scale),
      new THREE.Vector3(300 * scale, 0.05, -40 * scale),
      new THREE.Vector3(180 * scale, 0.05, 40 * scale),
      new THREE.Vector3(240 * scale, 0.05, 180 * scale),
      new THREE.Vector3(120 * scale, 0.05, 280 * scale),
      new THREE.Vector3(-100 * scale, 0.05, 260 * scale),
      new THREE.Vector3(-240 * scale, 0.05, 160 * scale),
      new THREE.Vector3(-200 * scale, 0.05, 40 * scale),
      new THREE.Vector3(-100 * scale, 0.05, 0)
    ];

    this.curve = new THREE.CatmullRomCurve3(points, true);

    this.boostPadTexture = this.createBoostPadTexture();

    this.boostPads = [];
    this.itemBoxes = [];
    this.decorations = [];
    this.barriers = []; // Vacío en mundo libre (sin vallas colisionables)

    this.createRoad();
    this.createStartBanner();
    this.spawnBoostPads();
    this.spawnItemBoxes();
    this.createEnvironment();
  }

  // --- GENERACIÓN DE LA CARRETERA (Plana y sin setos colisionables) ---
  createRoad() {
    const roadGeometry = new THREE.BufferGeometry();
    const vertices = [];
    const indices = [];
    const uvs = [];

    const curvePoints = this.curve.getSpacedPoints(this.segments);
    const roadPoints = [];

    for (let i = 0; i <= this.segments; i++) {
      const t = i / this.segments;
      const point = this.curve.getPointAt(t);
      const tangent = this.curve.getTangentAt(t).normalize();
      
      const up = new THREE.Vector3(0, 1, 0);
      const binormal = new THREE.Vector3().crossVectors(tangent, up).normalize();
      const normal = new THREE.Vector3().crossVectors(binormal, tangent).normalize();

      roadPoints.push({ point, tangent, binormal, normal });

      // Generar arcenes planos
      const leftVert = new THREE.Vector3().copy(point).addScaledVector(binormal, -this.roadWidth / 2);
      const rightVert = new THREE.Vector3().copy(point).addScaledVector(binormal, this.roadWidth / 2);

      vertices.push(leftVert.x, leftVert.y, leftVert.z);
      vertices.push(rightVert.x, rightVert.y, rightVert.z);

      uvs.push(0, t * 40);

      if (i < this.segments) {
        const v0 = i * 2;
        const v1 = i * 2 + 1;
        const v2 = (i + 1) * 2;
        const v3 = (i + 1) * 2 + 1;

        indices.push(v0, v1, v2);
        indices.push(v1, v3, v2);
      }
    }

    roadGeometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
    roadGeometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
    roadGeometry.setIndex(indices);
    roadGeometry.computeVertexNormals();

    const roadMaterial = new THREE.MeshStandardMaterial({
      color: 0x7c858e, // Carretera asfalto gris
      roughness: 0.85,
      metalness: 0.05,
      side: THREE.DoubleSide
    });

    const roadMesh = new THREE.Mesh(roadGeometry, roadMaterial);
    roadMesh.receiveShadow = true;
    this.scene.add(roadMesh);
    
    this.roadMesh = roadMesh;
    this.roadPoints = roadPoints;

    // Dibujar arcenes visuales finos (líneas blancas en los bordes) para delimitar la pista
    this.createRoadLines(roadPoints);
  }

  createRoadLines(roadPoints) {
    const leftLinePoints = [];
    const rightLinePoints = [];

    for (let i = 0; i <= this.segments; i++) {
      const rp = roadPoints[i];
      // Líneas ligeramente por dentro del borde y elevadas 0.01 del asfalto para evitar z-fighting
      const leftP = new THREE.Vector3().copy(rp.point).addScaledVector(rp.binormal, -this.roadWidth / 2 + 0.4).add(new THREE.Vector3(0, 0.01, 0));
      const rightP = new THREE.Vector3().copy(rp.point).addScaledVector(rp.binormal, this.roadWidth / 2 - 0.4).add(new THREE.Vector3(0, 0.01, 0));
      leftLinePoints.push(leftP);
      rightLinePoints.push(rightP);
    }

    const lineMat = new THREE.MeshBasicMaterial({ color: 0xffffff, side: THREE.DoubleSide });
    
    // Crear bandas blancas finas de 0.2 metros de ancho
    this.buildFlatStripe(leftLinePoints, 0.25, lineMat);
    this.buildFlatStripe(rightLinePoints, 0.25, lineMat);
  }

  buildFlatStripe(pointsList, width, material) {
    const stripeGeom = new THREE.BufferGeometry();
    const vertices = [];
    const indices = [];

    for (let i = 0; i < pointsList.length; i++) {
      const p = pointsList[i];
      const t = this.curve.getTangentAt(i / pointsList.length).normalize();
      const bin = new THREE.Vector3().crossVectors(t, new THREE.Vector3(0, 1, 0)).normalize();

      const vL = new THREE.Vector3().copy(p).addScaledVector(bin, -width / 2);
      const vR = new THREE.Vector3().copy(p).addScaledVector(bin, width / 2);

      vertices.push(vL.x, vL.y, vL.z);
      vertices.push(vR.x, vR.y, vR.z);

      if (i < pointsList.length - 1) {
        const v0 = i * 2;
        const v1 = i * 2 + 1;
        const v2 = (i + 1) * 2;
        const v3 = (i + 1) * 2 + 1;

        indices.push(v0, v1, v2);
        indices.push(v1, v3, v2);
      }
    }

    stripeGeom.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
    stripeGeom.setIndex(indices);
    stripeGeom.computeVertexNormals();

    const mesh = new THREE.Mesh(stripeGeom, material);
    this.scene.add(mesh);
  }

  // Arco decorativo de meta
  createStartBanner() {
    const bannerGroup = new THREE.Group();
    const pStart = this.curve.getPointAt(0);
    const tangent = this.curve.getTangentAt(0).normalize();
    const binormal = new THREE.Vector3().crossVectors(tangent, new THREE.Vector3(0, 1, 0)).normalize();

    const colGeom = new THREE.CylinderGeometry(0.8, 1.0, 18, 8);
    const woodMat = new THREE.MeshStandardMaterial({ color: 0x734824, roughness: 0.9 });
    
    // Coordenadas relativas al origen local del bannerGroup
    const colLeft = new THREE.Mesh(colGeom, woodMat);
    colLeft.position.set(-this.roadWidth / 2 - 1, 9, 0);
    colLeft.castShadow = true;
    
    const colRight = new THREE.Mesh(colGeom, woodMat);
    colRight.position.set(this.roadWidth / 2 + 1, 9, 0);
    colRight.castShadow = true;

    const crossGeom = new THREE.CylinderGeometry(0.7, 0.7, this.roadWidth + 4, 8);
    crossGeom.rotateZ(Math.PI / 2);
    const crossBar = new THREE.Mesh(crossGeom, woodMat);
    crossBar.position.set(0, 18, 0);
    crossBar.castShadow = true;

    const signGeom = new THREE.BoxGeometry(16, 4, 0.5);
    const signMat = new THREE.MeshStandardMaterial({ color: 0xe67e22, roughness: 0.8 });
    const signMesh = new THREE.Mesh(signGeom, signMat);
    signMesh.position.set(0, 15, 0);
    signMesh.castShadow = true;

    bannerGroup.add(colLeft, colRight, crossBar, signMesh);
    
    // Posicionar y orientar el bannerGroup en su ubicación global
    bannerGroup.position.copy(pStart);
    const lookTarget = new THREE.Vector3().copy(pStart).add(tangent);
    bannerGroup.lookAt(lookTarget);

    this.scene.add(bannerGroup);

    // Guardar columnas como postes sólidos para colisión (en coordenadas globales)
    const posLeft = new THREE.Vector3().copy(pStart).addScaledVector(binormal, -this.roadWidth / 2 - 1);
    const posRight = new THREE.Vector3().copy(pStart).addScaledVector(binormal, this.roadWidth / 2 + 1);
    this.decorations.push({ position: posLeft, radius: 1.2 });
    this.decorations.push({ position: posRight, radius: 1.2 });
  }

  // Aceleradores
  spawnBoostPads() {
    const padPositions = [0.08, 0.28, 0.52, 0.76, 0.92];
    const padGeom = new THREE.PlaneGeometry(8, 5);
    
    padPositions.forEach((t) => {
      const p = this.curve.getPointAt(t);
      const tangent = this.curve.getTangentAt(t).normalize();
      const binormal = new THREE.Vector3().crossVectors(tangent, new THREE.Vector3(0, 1, 0)).normalize();
      
      const pos = new THREE.Vector3().copy(p).add(new THREE.Vector3(0, 0.08, 0));
      const laneShift = (Math.random() > 0.5 ? 1 : -1) * (this.roadWidth * 0.25);
      pos.addScaledVector(binormal, laneShift);

      const padMat = new THREE.MeshStandardMaterial({
        map: this.boostPadTexture,
        roughness: 0.2,
        metalness: 0.8,
        emissive: new THREE.Color(0xffaa00),
        emissiveMap: this.boostPadTexture,
        emissiveIntensity: 1.5,
        side: THREE.DoubleSide,
        transparent: true,
        opacity: 0.95
      });

      const pad = new THREE.Mesh(padGeom, padMat);
      pad.position.copy(pos);
      
      const lookTarget = new THREE.Vector3().copy(pos).add(tangent);
      pad.lookAt(lookTarget);
      pad.rotation.x = -Math.PI / 2;
      
      this.scene.add(pad);
      this.boostPads.push(pad);
    });
  }

  // Burbujas
  spawnItemBoxes() {
    const boxSplineSteps = [0.18, 0.38, 0.62, 0.84];
    const numBoxesPerStation = 3;

    boxSplineSteps.forEach((t) => {
      const p = this.curve.getPointAt(t);
      const tangent = this.curve.getTangentAt(t).normalize();
      const binormal = new THREE.Vector3().crossVectors(tangent, new THREE.Vector3(0, 1, 0)).normalize();

      for (let i = 0; i < numBoxesPerStation; i++) {
        const offsetPct = (i / (numBoxesPerStation - 1)) - 0.5;
        const laneOffset = offsetPct * (this.roadWidth * 0.65);
        
        const boxPos = new THREE.Vector3()
          .copy(p)
          .addScaledVector(binormal, laneOffset)
          .add(new THREE.Vector3(0, 2.2, 0));

        const bubbleGeom = new THREE.SphereGeometry(1.3, 10, 10);
        const innerGeom = new THREE.OctahedronGeometry(0.65);

        const bubbleMat = new THREE.MeshBasicMaterial({
          color: 0x00d2ff,
          transparent: true,
          opacity: 0.55,
          wireframe: false
        });
        
        const innerMat = new THREE.MeshBasicMaterial({
          color: 0xffdd00,
          transparent: true,
          opacity: 0.85
        });

        const boxGroup = new THREE.Group();
        const outerMesh = new THREE.Mesh(bubbleGeom, bubbleMat);
        const innerMesh = new THREE.Mesh(innerGeom, innerMat);

        boxGroup.add(outerMesh);
        boxGroup.add(innerMesh);
        boxGroup.position.copy(boxPos);

        this.scene.add(boxGroup);

        this.itemBoxes.push({
          mesh: boxGroup,
          active: true,
          respawnTimer: 0,
          initialY: boxPos.y
        });
      }
    });
  }

  // --- ENTORNO DE CAMPIÑA ABIERTA ---
  createEnvironment() {
    // Suelo de césped a altura Y = 0.0 (alineado con la pista)
    const grassGeom = new THREE.PlaneGeometry(3500, 3500);
    const grassMat = new THREE.MeshStandardMaterial({
      color: 0x6bb85c,
      roughness: 1.0,
      metalness: 0.0
    });
    const grassMesh = new THREE.Mesh(grassGeom, grassMat);
    grassMesh.rotation.x = -Math.PI / 2;
    grassMesh.position.y = 0; // Al ras de la carretera
    grassMesh.receiveShadow = true;
    this.scene.add(grassMesh);

    // Colinas ondulantes
    const numHills = 50;
    const hillGeom = new THREE.SphereGeometry(80, 12, 12);
    const hillMat = new THREE.MeshStandardMaterial({
      color: 0x5a9a4c,
      roughness: 1.0,
      metalness: 0.0
    });

    for (let i = 0; i < numHills; i++) {
      const hill = new THREE.Mesh(hillGeom, hillMat);
      const scaleY = 0.25 + Math.random() * 0.35;
      const radius = 80 + Math.random() * 100;
      hill.scale.set(radius / 80, scaleY, radius / 80);

      let validPos = false;
      let x = 0, z = 0;
      while (!validPos) {
        x = (Math.random() - 0.5) * 1600;
        z = (Math.random() - 0.5) * 1600;

        const testPoint = new THREE.Vector3(x, 0, z);
        const closestPoint = this.getClosestSplinePoint(testPoint);
        // Mantener las colinas completamente apartadas en base a su radio real
        if (testPoint.distanceTo(closestPoint) > (radius + 40)) {
          validPos = true;
        }
      }

      hill.position.set(x, (80 * scaleY) / 2 - 10, z); // Hundir un poco la base de la esfera
      hill.receiveShadow = true;
      this.scene.add(hill);
    }

    // Árboles esparcidos por el parque
    const numTrees = 80;
    for (let i = 0; i < numTrees; i++) {
      const t = (i / numTrees);
      const p = this.curve.getPointAt(t);
      const tangent = this.curve.getTangentAt(t).normalize();
      const binormal = new THREE.Vector3().crossVectors(tangent, new THREE.Vector3(0, 1, 0)).normalize();

      const side = (i % 2 === 0 ? 1 : -1);
      // Colocar un poco más apartados de la carretera
      const treePos = new THREE.Vector3()
        .copy(p)
        .addScaledVector(binormal, side * (this.roadWidth / 2 + 10));

      this.createParkTree(treePos);
    }
  }

  createParkTree(position) {
    const treeGroup = new THREE.Group();

    const trunkGeom = new THREE.CylinderGeometry(0.4, 0.6, 6, 8);
    const trunkMat = new THREE.MeshStandardMaterial({ color: 0x6e4722, roughness: 0.9 });
    const trunk = new THREE.Mesh(trunkGeom, trunkMat);
    trunk.position.y = 3;
    trunk.castShadow = true;
    treeGroup.add(trunk);

    const foliageColors = [0x227733, 0x338844, 0x449955];
    
    const foliage1Geom = new THREE.SphereGeometry(2.4, 8, 8);
    const foliage1Mat = new THREE.MeshStandardMaterial({ color: foliageColors[0], roughness: 0.9 });
    const foliage1 = new THREE.Mesh(foliage1Geom, foliage1Mat);
    foliage1.position.y = 5.5;
    foliage1.castShadow = true;
    treeGroup.add(foliage1);

    const foliage2Geom = new THREE.SphereGeometry(1.9, 8, 8);
    const foliage2Mat = new THREE.MeshStandardMaterial({ color: foliageColors[1], roughness: 0.9 });
    const foliage2 = new THREE.Mesh(foliage2Geom, foliage2Mat);
    foliage2.position.y = 7.5;
    foliage2.castShadow = true;
    treeGroup.add(foliage2);

    const foliage3Geom = new THREE.SphereGeometry(1.3, 8, 8);
    const foliage3Mat = new THREE.MeshStandardMaterial({ color: foliageColors[2], roughness: 0.9 });
    const foliage3 = new THREE.Mesh(foliage3Geom, foliage3Mat);
    foliage3.position.y = 9.0;
    foliage3.castShadow = true;
    treeGroup.add(foliage3);

    treeGroup.position.copy(position);
    // Ajustar base a Y=0
    treeGroup.position.y = 0;
    this.scene.add(treeGroup);

    // Guardar el tronco como objeto colisionable
    this.decorations.push({
      position: position.clone(),
      radius: 0.95
    });
  }

  // --- MÉTODOS DE ACTUALIZACIÓN Y FÍSICAS ---

  update(deltaTime) {
    this.itemBoxes.forEach((box) => {
      if (box.active) {
        box.mesh.rotation.y += 1.0 * deltaTime;
        box.mesh.position.y = box.initialY + Math.sin(Date.now() * 0.002) * 0.25;
      } else {
        box.respawnTimer -= deltaTime;
        if (box.respawnTimer <= 0) {
          box.active = true;
          box.mesh.visible = true;
        }
      }
    });
  }

  getClosestSplinePoint(pos) {
    let closestPoint = null;
    let minDist = Infinity;
    
    for (let i = 0; i < this.roadPoints.length; i++) {
      const rp = this.roadPoints[i].point;
      const dist = pos.distanceTo(rp);
      if (dist < minDist) {
        minDist = dist;
        closestPoint = rp;
      }
    }
    return closestPoint || this.curve.getPointAt(0);
  }

  getRoadHeightAndNormal(pos) {
    let closestIdx = 0;
    let minDist = Infinity;

    for (let i = 0; i < this.roadPoints.length; i++) {
      const rp = this.roadPoints[i].point;
      const dx = pos.x - rp.x;
      const dz = pos.z - rp.z;
      const distSq = dx * dx + dz * dz;
      
      if (distSq < minDist) {
        minDist = distSq;
        closestIdx = i;
      }
    }

    const rp = this.roadPoints[closestIdx];
    const distanceToSpline = pos.distanceTo(rp.point);
    
    // Ancho de carretera (la carretera se extiende a ambos lados, por lo que usamos la mitad del ancho total)
    const isOnRoad = (distanceToSpline < this.roadWidth * 0.5 * 0.95);
    const progress = closestIdx / this.segments;

    return {
      height: rp.point.y,
      normal: rp.normal,
      binormal: rp.binormal,
      tangent: rp.tangent,
      isOnRoad: isOnRoad,
      distanceToCenter: distanceToSpline,
      progress: progress,
      segmentIndex: closestIdx
    };
  }

  // En mundo libre no hay barreras de muros
  checkBarrierCollision(kartPos, kartRadius) {
    return { collided: false };
  }

  // Genera procedimentalmente una textura Cyber Neon para las plataformas de turbo (boost pads)
  createBoostPadTexture() {
    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 512;
    const ctx = canvas.getContext('2d');

    // 1. Fondo oscuro
    ctx.fillStyle = '#0a0a14';
    ctx.fillRect(0, 0, 512, 512);

    // Rejilla de fondo
    ctx.strokeStyle = 'rgba(255, 170, 0, 0.15)';
    ctx.lineWidth = 4;
    for (let x = 0; x < 512; x += 32) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, 512);
      ctx.stroke();
    }
    for (let y = 0; y < 512; y += 32) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(512, y);
      ctx.stroke();
    }

    // 2. Bandas laterales de peligro (amarillo y negro)
    const stripeWidth = 32;
    ctx.fillStyle = '#ffaa00';
    for (let y = -stripeWidth; y < 512 + stripeWidth; y += stripeWidth * 2) {
      // Izquierda
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(stripeWidth, y + stripeWidth);
      ctx.lineTo(stripeWidth, y + stripeWidth * 2);
      ctx.lineTo(0, y + stripeWidth);
      ctx.closePath();
      ctx.fill();

      // Derecha
      ctx.beginPath();
      ctx.moveTo(512, y);
      ctx.lineTo(512 - stripeWidth, y + stripeWidth);
      ctx.lineTo(512 - stripeWidth, y + stripeWidth * 2);
      ctx.lineTo(512, y + stripeWidth);
      ctx.closePath();
      ctx.fill();
    }

    // 3. Flechas (Chevrons >>>) apuntando hacia arriba (V=1, es decir, adelante)
    ctx.shadowColor = '#ffea00';
    ctx.shadowBlur = 20;
    ctx.fillStyle = '#ffb700';

    for (let i = 0; i < 3; i++) {
      const centerY = 120 + i * 140; // Separadas verticalmente
      ctx.beginPath();
      ctx.moveTo(256, centerY - 50); // Punta
      ctx.lineTo(256 + 140, centerY + 30);
      ctx.lineTo(256 + 80, centerY + 30);
      ctx.lineTo(256, centerY - 15);
      ctx.lineTo(256 - 80, centerY + 30);
      ctx.lineTo(256 - 140, centerY + 30);
      ctx.closePath();
      ctx.fill();
    }

    // 4. Borde neón brillante
    ctx.shadowBlur = 25;
    ctx.shadowColor = '#ffaa00';
    ctx.strokeStyle = '#ffcc00';
    ctx.lineWidth = 16;
    ctx.strokeRect(8, 8, 496, 496);

    const texture = new THREE.CanvasTexture(canvas);
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.RepeatWrapping;
    return texture;
  }
}
