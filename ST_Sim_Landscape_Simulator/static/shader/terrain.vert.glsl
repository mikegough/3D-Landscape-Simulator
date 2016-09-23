// terrain.vert

// heightmap to get vertical amounts from
uniform sampler2D heightmap;
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
    return (texture.r + texture.g * 256.0) * disp;
}

void main() 
{ 
    vUV = uv;
    vAmount = decodeElevation(texture2D(heightmap, uv));

    // vertical amount based on heightmap texture
    vec4 pos = vec4(position, 1.0);
    
    // use this fN for lighting based on the eye position
    //fN = normalize( modelViewMatrix*vec4(normal, 0.0) ).xyz;
    //fE = -(modelViewMatrix*pos).xyz;
    //fL = lightPosition - (modelViewMatrix*pos).xyz;

    // use this for lighting based on sun location
    fN = normalize( vec4(normal, 0.0) ).xyz;
    fE = -(modelViewMatrix*pos).xyz;
    fL = lightPosition;

        // set the position since we don't need to alter it
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);

}