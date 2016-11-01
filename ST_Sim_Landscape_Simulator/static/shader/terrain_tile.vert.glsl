// terrain.vert

// heightmap to get vertical amounts from

uniform sampler2D active_texture;
uniform float disp;

// texel varyings
varying float vAmount;
varying vec2 vUV;

// light uniforms
uniform vec3 lightPosition;

// light varyings
varying vec3 fN;
varying vec3 fE;
varying vec3 fL;

float decodeElevation(vec4 texture) {
    return (texture.r * 255.0 + texture.g * 255.0 * 255.0) / (5000.0);
}


void main() 
{ 
    vUV = uv;
    vAmount = decodeElevation(texture2D(active_texture, uv));   // only used when elevation is the active texture
    vec3 pos = vec3(position.xy, position.z * disp);
    // use this for lighting based on sun location
    fN = normalize( vec4(normal, 0.0) ).xyz;
    fE = -(modelViewMatrix*vec4(position, 1.0)).xyz;
    fL = lightPosition;

        // set the position since we don't need to alter it
    gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);

}