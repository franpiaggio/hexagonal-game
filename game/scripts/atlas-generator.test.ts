import assert from 'node:assert/strict'
import test from 'node:test'
import { readFileSync } from 'node:fs'
import { FAMILIES, buildTerrain, generatePlan, waterDistance, heightAt, roadDistance } from '../demos/02-atlas-patagonico/landscape.ts'

test('toda pieza texturizada del GLB conserva sus coordenadas UV', () => {
  const buffer=readFileSync(new URL('../public/assets/atlas/atlas.glb',import.meta.url))
  const length=buffer.readUInt32LE(12)
  const gltf=JSON.parse(buffer.subarray(20,20+length).toString())
  let textured=0
  for(const mesh of gltf.meshes) for(const primitive of mesh.primitives) {
    if(gltf.materials[primitive.material]?.pbrMetallicRoughness?.baseColorTexture) {
      textured++
      assert.ok('TEXCOORD_0' in primitive.attributes,'Una textura sin UV se muestrea en una esquina y pierde el follaje.')
    }
  }
  assert.ok(textured>=8)
})

test('una semilla reconstruye el mismo paisaje y otra produce una variante', () => {
  assert.deepEqual(generatePlan(73020), generatePlan(73020))
  assert.notDeepEqual(generatePlan(73020), generatePlan(73021))
})

test('las seis familias conservan caseríos pequeños, suelo firme y árboles fuera de accesos', () => {
  for (const family of FAMILIES) for (const seed of [1,2,7,19,42,97,423,811,73020,4294967295]) {
    const plan = generatePlan(seed,family)
    assert.ok(plan.houses.length >= 5 && plan.houses.length <= 11, `${family}/${seed}: ${plan.houses.length} casas`)
    assert.ok(plan.focus.every(Number.isFinite))
    assert.ok(plan.trees.length > 400 && plan.trees.length < 4225)
    for (const house of plan.houses) {
      assert.ok(waterDistance(plan,house.x,house.z) >= 1.65)
      assert.equal(house.y,heightAt(plan,house.x,house.z))
    }
    for (const tree of plan.trees) {
      assert.ok(waterDistance(plan,tree.x,tree.z) >= .9)
      assert.ok(roadDistance(plan,tree.x,tree.z) >= 1)
      assert.ok(plan.houses.every(h => Math.hypot(tree.x-h.x,tree.z-h.z) >= 2))
    }
  }
})

test('el terreno completo tiene índices válidos, color finito y alturas coherentes', () => {
  const plan = generatePlan(73020,'bahia'), terrain = buildTerrain(plan)
  for (const values of [terrain.positions,terrain.colors,terrain.waterColors,terrain.layers]) assert.ok(values.every(Number.isFinite))
  const vertices = terrain.positions.length / 3
  assert.equal(terrain.colors.length,terrain.positions.length)
  assert.equal(terrain.layers.length,terrain.positions.length)
  assert.ok(terrain.layers.every(weight=>weight>=0 && weight<=1))
  assert.ok(terrain.indices.every(i => i < vertices))
  assert.ok(terrain.colors.every(c => c >= 0 && c <= 1))
  for (let i=0;i<vertices;i+=791) {
    const [x,y,z] = terrain.positions.subarray(i*3,i*3+3)
    assert.ok(Math.abs(y-heightAt(plan,x,z)) < .00001)
  }
})

test('las lomas conservan la costa y los edificios tienen una terraza horizontal', () => {
  for (const family of FAMILIES) {
    const plan=generatePlan(73020,family)
    const heights=[]
    for(let z=-24;z<=36;z+=2) for(let x=-30;x<=30;x+=2) {
      const h=heightAt(plan,x,z), shore=waterDistance(plan,x,z)
      if(shore<0) assert.ok(h<0,`${family}: el relieve invadió el agua`)
      if(shore>2) heights.push(h)
    }
    assert.ok(Math.max(...heights)-Math.min(...heights)>3,`${family}: terreno sin relieve legible`)
    for(const house of plan.houses) for(const dx of [-.65,0,.65]) for(const dz of [-.65,0,.65]) {
      assert.ok(Math.abs(heightAt(plan,house.x+dx,house.z+dz)-house.y)<.035,`${family}: base inclinada bajo ${house.kind}`)
    }
  }
})
