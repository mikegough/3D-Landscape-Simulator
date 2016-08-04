// terrain.vert
// phong lighting courtest of Prof. Orr, Willamette, via Angel.hpp


// heightmap to get vertical amounts from
uniform sampler2D heightmap;

// texel varyings
varying float vAmount;
varying vec2 vUV;

// light varyings
varying vec3 fN;
varying vec3 fE;
varying vec3 fL;

void main() 
{ 
    vUV = uv;
    vAmount = texture2D(heightmap, uv).r;
    
    // vertical amount based on heightmap texture
    vec4 light_position  = vec4(1.0,3.0,-1.0,1.0);	// assumed in eye position
    vec4 pos = vec4(position, 1.0);
    
    // use this fN for lighting based on the eye position
    //fN = normalize( modelViewMatrix*vec4(normal, 0.0) ).xyz;
    //fE = -(modelViewMatrix*pos).xyz;
    //fL = light_position.xyz - (modelViewMatrix*pos).xyz;

    // use this for lighting based on sun location
    fN = normalize( vec4(normal, 0.0) ).xyz;
    fE = -(modelViewMatrix*pos).xyz;
    fL = light_position.xyz;

        // set the position since we don't need to alter it
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);

}