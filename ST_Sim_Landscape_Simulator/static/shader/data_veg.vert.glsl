// data_veg.vert

// include PI and other nice things from the THREE ShaderLib
#include <common>

uniform mat4 modelViewMatrix;
uniform mat4 projectionMatrix;
uniform mat4 normalMatrix;
uniform sampler2D heightmap;
uniform float disp;
uniform float maxHeight;

attribute vec3 position;
attribute vec2 offset;
attribute vec2 hCoord;
attribute vec2 uv;
attribute float rotation;

varying vec2 vUV;
varying vec2 scUV; 

// Rotate by angle
vec2 rotate (float x, float y, float r) {
    float c = cos(r);
    float s = sin(r);
    return vec2(x * c - y * s, x * s + y * c);
}



void main() {
    vUV = uv;
    scUV = hCoord;
    float vAmount = texture2D(heightmap, hCoord).r;
    vec3 newPosition = position;

    // rotate around the y axis
    newPosition.xz = rotate(newPosition.x, newPosition.z, PI * rotation);

    // now translate to the offset position
    newPosition += vec3(offset.x, vAmount * maxHeight * disp, offset.y);
    gl_Position = projectionMatrix * modelViewMatrix * vec4(newPosition, 1.0);
}