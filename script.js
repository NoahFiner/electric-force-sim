var sim, ctx, canvas, cHeight, cWidth;
var particles = [];
var eFields = [];
var walls = [];

var eFieldDivision = 10;
var bounceOffSides = true;


var mu = 0.03;
var gravity = 200;
var kConstant = 1000000;
var clickCharge = 1;
var fixedParticles = false;
var eFieldShown = false;
var forcesEnabled = true;
var forcesShown = true;

var clickMode = "place";

var gForce = 0;
var eForce = 0.5;
var fForce = 0;

var paused = false;

var mouseCoords = [0, 0];

//By Titus Cieslewski on Stackoverflow.com
//Size should be between 0 and 1
function canvas_arrow(context, fromx, fromy, tox, toy, size, color = "#000000") {
  var headlen = 10*size;   // length of head in pixels
  var angle = Math.atan2(toy-fromy,tox-fromx);
  context.beginPath();
  context.moveTo(fromx, fromy);
  context.lineTo(tox, toy);
  context.lineTo(tox-headlen*Math.cos(angle-Math.PI/6),toy-headlen*Math.sin(angle-Math.PI/6));
  context.moveTo(tox, toy);
  context.lineTo(tox-headlen*Math.cos(angle+Math.PI/6),toy-headlen*Math.sin(angle+Math.PI/6));
  ctx.lineWidth = "1";
  context.strokeStyle = color || "#000000";
  context.stroke();
  context.closePath();
}

var init = function() {
  canvas = document.getElementById("canvas-outer");
  cHeight = canvas.offsetHeight;
  cWidth = canvas.offsetWidth;
  cDimensions = [cWidth, cHeight];
  ctx = canvas.getContext("2d");

  particles = [];
  eFields = [];
  walls = [];

  sim = new Simulation();
  sim.start();

  addElectricFields();

  window.requestAnimationFrame(update);

  $("#canvas-outer").on("click", function(event) {delegateClick(getMousePos(canvas, event).x, getMousePos(canvas, event).y)});
  // canvas.addEventListener("click", function(event) {addParticle(getMousePos(canvas, event).x, getMousePos(canvas, event).y, clickCharge, 1)});
}

var restart = function() {
  particles = [];
  walls = [];
  if(paused) alternatePause();
  sim.start();
}

function Simulation() {
  this.particleAmt = 0;
  this.start = function() {
  ctx.clearRect(0, 0, cHeight, cWidth);
  }
}

function Particle(id, x, y, radius, charge, density, gravityEffect) {
  this.id = id;
  this.type = "particle";
  this.coords = [x, y];
  this.radius = radius;
  this.area = this.radius*this.radius*Math.PI;
  this.mass = this.area*density;
  this.charge = charge;
  this.density = density;
  this.velocity = [0, 0];
  this.acceleration = [0, 0];
  this.force = [0, 0];
  this.gravityEffect = gravityEffect; // should be 1 or 0

  if(this.charge > 0) {
    this.color = "#0000ff";
  } else if(this.charge < 0) {
    this.color = "#ff0000";
  } else {
    this.color = "#888888";
  }

  this.getDistanceFrom = function(coords1, coords2) {
    return Math.sqrt(Math.pow(coords1[0] - coords2[0], 2) + Math.pow(coords1[1] - coords2[1], 2));
  }

  this.getForceFromCharges = function() {
    var result = [0, 0];
    for(i = 0; i < particles.length; i++) {
      if((i !== this.id || this.type === "field") && (forcesEnabled || this.type === "field")) {
        var magnitude = (kConstant*eForce)/Math.pow(this.getDistanceFrom(this.coords, particles[i].coords), 2);
        if(this.getDistanceFrom(this.coords, particles[i].coords) <= this.radius + particles[i].radius) {
          magnitude = (-kConstant*eForce)/Math.pow(this.radius + particles[i].radius, 2);
        }

        var theta = Math.atan((particles[i].coords[1] - this.coords[1])/(particles[i].coords[0] - this.coords[0])) //arctan(y/x) to get theta

        //correct arctan issues
        if(particles[i].coords[1] < this.coords[1] && particles[i].coords[0] < this.coords[0]) {
          theta += Math.PI;
        }
        else if(particles[i].coords[0] < this.coords[0]) {
          theta += Math.PI;
        }

        //in case the user places a charge directly on another charge
        if(Math.abs(magnitude) > 10000 || isNaN(magnitude) || isNaN(theta)) {
          magnitude = Math.random()*1000 + 100;
          theta = Math.random()*Math.PI*2;
        }

        //continue correcting arctan issues
        magnitude *= -(particles[i].charge*this.charge);
        result[0] += magnitude*Math.cos(theta);
        result[1] += magnitude*Math.sin(theta);
      }
    }
    return result;
  }

  this.dot = function(vec1, vec2) {
    return vec1[0]*vec2[0] + vec1[1]*vec2[1];
  }

  this.mag = function(vec) {
    return Math.sqrt(vec[0]*vec[0] + vec[1]*vec[1]);
  }

  this.cosAngleBetween = function(vec1, vec2) {
    return this.dot(vec1, vec2)/(this.mag(vec1)*this.mag(vec2));
  }

  this.addFriction = function() {
    this.velocity[0] *= (1-mu*fForce);
    this.velocity[1] *= (1-mu*fForce);
  }

  this.drawForceLine = function() {
    if(forcesShown || this.type === "field") {
      //The arrow's size should depend on how large the magnitude is
      //Also remove gravity from the arrow's y component if it's on
      var mag = Math.sqrt(Math.pow(this.force[0], 2) + Math.pow(this.force[1] - gravity*this.gravityEffect*gForce, 2));
      var color = "#000000";
      if(this.type === "field") {
        color = "#aaaaaa";
      }
      var size = -Math.pow(Math.E, -0.002*Math.pow(mag, 2)) + 1
      var arrowXForce = this.force[0];
      var arrowYForce = this.force[1] - gravity*this.gravityEffect*gForce;

      //avoid lines for electric fields being too big
      if(mag > 100 && this.type === "field") {
        var theta = Math.atan(arrowYForce/arrowXForce);

        //correct arctan issues
        if(arrowXForce < 0 && arrowYForce > 0) {
          theta += Math.PI;
        }
        else if(arrowXForce < 0) {
          theta += Math.PI;
        }

        arrowXForce = 100*Math.cos(theta);
        arrowYForce = 100*Math.sin(theta);
      }
      canvas_arrow(ctx, this.coords[0], this.coords[1], arrowXForce + this.coords[0], arrowYForce + this.coords[1], size, color);
    }
  }

  this.updateFromForce = function() {
    this.force = this.getForceFromCharges();
    this.force[1] += gravity*this.gravityEffect*gForce; //add gravity to the force vector
    this.acceleration = [0, 0];
    for(var i = 0; i < this.acceleration.length; i++) {
      this.acceleration[i] += (this.force[i]/this.mass);
    }
    this.updateFromAccel();
  }

  this.updateFromAccel = function() {
    for(var i = 0; i < this.acceleration.length; i++) {
      this.velocity[i] += this.acceleration[i];
    }
    if(!paused) {
      this.updateFromVelocity();
    }
  }

  //rotates the velocity rads radians counterclockwise
  this.rotateVelocity = function(rads) {
    // console.log(this.velocity);
    var result = [0, 0];
    result[0] = this.velocity[0]*Math.cos(rads) + this.velocity[1]*Math.sin(rads);
    result[1] = -this.velocity[0]*Math.sin(rads) + this.velocity[1]*Math.cos(rads);
    this.velocity = result;
  }

  this.updateFromVelocity = function() {
    for(var i = 0; i < walls.length; i++) {
      if(walls[i].containsCoords([this.coords[0] + this.velocity[0], this.coords[1] + this.velocity[1]])) {
        walls[i].draw("#ff00ff");
        var normal = [];
        normal[0] = -walls[i].slope[1];
        normal[1] = walls[i].slope[0];
        var cosTheta = this.cosAngleBetween(normal, this.velocity);
        var theta = 2*Math.acos(cosTheta);
        if(theta > Math.PI/2) {
          theta -= Math.PI/2;
        }
        // console.log(Math.acos(this.cosAngleBetween(walls[i].slope, [walls[i].centerCoords[0] - this.coords[0], walls[i].centerCoords[1] - this.coords[1]])));
        this.rotateVelocity(2*theta);
      }
    }

    if(bounceOffSides) {
      for(var k = 0; k < 2; k++) {
        if(this.coords[k] + this.velocity[k] <= 0 + this.radius) {
          //TODO: FIX THIS
          // this.coords[k] = this.coords[k]*-1 + this.radius; //put the particle on the opposite side of the wall in case it will hit it and go too far into it
          this.velocity[k] *= -0.95;
        }
        if(this.coords[k] + this.velocity[k] >= cDimensions[k] - this.radius) {
          // this.coords[k] = 600 - this.radius + (600 + this.coords[k]*-1); //put the particle on the opposite side of the wall in case it will hit it and go too far into it
          this.velocity[k] *= -0.95;
        }
      }
    }

    this.addFriction(); //add "friction" if mu is > 0

    for(var j = 0; j < this.acceleration.length; j++) {
      this.coords[j] += this.velocity[j];
    }
  }

  this.draw = function() {
    this.drawForceLine();
    ctx.beginPath();
    // ctx.rect(this.coords[0], this.coords[1], this.radius, this.radius);
    ctx.arc(this.coords[0], this.coords[1], this.radius, 0, 2*Math.PI, false);
    ctx.fillStyle = this.color;
    ctx.fill();
    if(this.getDistanceFrom(mouseCoords, this.coords) < 40 && clickMode === "erase") {
      ctx.strokeStyle = "#a00";
      ctx.lineWidth = "5";
      ctx.stroke();
    }
    // ctx.closePath();
  }
}

var FixedParticle = function(id, x, y, radius, charge) {
  Particle.call(this, id, x, y, radius, charge, 1, 0);

  this.type = "fixed";

  this.updateFromForce = function() {
    this.force = this.getForceFromCharges();
  }

  this.draw = function(color=this.color) {
    this.drawForceLine();
    ctx.beginPath();
    ctx.arc(this.coords[0], this.coords[1], this.radius, 0, 2*Math.PI, false);
    ctx.fillStyle = color;
    ctx.fill();
    ctx.lineWidth = "2";
    ctx.strokeStyle = "#000000";
    if(this.getDistanceFrom(mouseCoords, this.coords) < 40 && clickMode == "erase") {
      ctx.strokeStyle = "#a00";
      ctx.lineWidth = "5";
    }
    ctx.stroke();
  }
}
FixedParticle.prototype = Object.create(Particle.prototype);
FixedParticle.prototype.constructor = FixedParticle;


var ElectricField = function(id, x, y) {
  this.id = eFields.length;
  FixedParticle.call(this, id, x, y, 1, 1, 1, 0);

  this.type = "field";

  this.draw = function() {
    if(eFieldShown) {
      this.force = this.getForceFromCharges();
      this.drawForceLine();
    }
  }
}
ElectricField.prototype = Object.create(FixedParticle.prototype);
ElectricField.prototype.constructor = ElectricField;

var Wall = function(id, x1, y1, x2, y2, charge, density, color="#333333") {
  this.id = id;
  this.coords1 = [x1, y1];
  this.coords2 = [x2, y2];
  this.centerCoords = [(x1 + x2)/2, (y1 + y2)/2];
  this.charge = charge;
  this.density = density;
  this.color = color;
  this.slope = [(y2 - y1), (x2 - x1)];
  this.width = 20;

  //using https://en.wikipedia.org/wiki/Distance_from_a_point_to_a_line
  this.getDistanceFrom = function(coords) {
    var numerator = Math.abs((this.coords2[1]-this.coords1[1])*coords[0] - (this.coords2[0]-this.coords1[0])*coords[1] + this.coords2[0]*this.coords1[1] - this.coords2[1]*this.coords1[0]);
    var denominator = Math.sqrt(Math.pow(this.coords2[1]-this.coords1[1], 2) + Math.pow(this.coords2[0]-this.coords1[0], 2));
    return numerator/denominator;
  }

  this.getDistanceFromCenter = function(coords) {
    return Math.sqrt(Math.pow(coords[0] - this.centerCoords[0], 2) + Math.pow(coords[1] - this.centerCoords[1], 2));
  }

  this.containsCoords = function(coords) {
    var length = 2*this.getDistanceFromCenter(this.coords1);
    if(this.getDistanceFrom(coords) < this.width && this.getDistanceFromCenter(coords) < length/2) {
      return true;
    }
    return false;
  }

  //gets quadrant of coords relative to the centercoords
  //  --  |  +-
  //    3 | 4
  // ------------
  //    2 | 1
  //  -+  |  ++
  this.relativeQuadrantOf = function(coords) {
    if(coords[0] > this.centerCoords[0] && coords[1] > this.centerCoords[1]) {
      return 1;
    }
    if(coords[0] < this.centerCoords[0] && coords[1] > this.centerCoords[1]) {
      return 2;
    }
    if(coords[0] < this.centerCoords[0] && coords[1] < this.centerCoords[1]) {
      return 3;
    }
    if(coords[0] > this.centerCoords[0] && coords[1] < this.centerCoords[1]) {
      return 4;
    }
  }

  this.draw = function(color=this.color) {
    ctx.beginPath();
    ctx.moveTo(this.coords1[0], this.coords1[1]);
    ctx.lineTo(this.coords2[0], this.coords2[1]);
    ctx.strokeStyle = color;
    ctx.lineWidth = this.width;
    ctx.stroke();
    ctx.closePath();
  }
}


var update = function() {
  var canvas = document.getElementById("canvas-outer");
  var ctx = canvas.getContext("2d");

  ctx.clearRect(0, 0, cWidth, cHeight);

  for(var i = 0; i < eFields.length; i++) {
    eFields[i].draw();
  }

  for(var i = 0; i < walls.length; i++) {
    walls[i].draw();
  }

  for(var i = 0; i < particles.length; i++) {
    particles[i].updateFromForce();
    particles[i].draw();
  }

  ctx.globalAlpha = 0.1;
  if(clickMode === "place") {
    if(clickCharge === "-1" || clickCharge === -1) {
      ctx.fillStyle = "#ff0000";
    } else if(clickCharge === 1 || clickCharge === "1") {
      ctx.fillStyle = "#0000ff";
    }
    ctx.beginPath();
    ctx.arc(mouseCoords[0], mouseCoords[1], 10, 0, 2*Math.PI, false);
    if(fixedParticles) {
      ctx.lineWidth = "3";
      ctx.strokeStyle = "#000000";
      ctx.stroke();
    }
    ctx.fill();
    ctx.closePath();
  } else if(clickMode === "erase") {
    ctx.beginPath();
    ctx.moveTo(mouseCoords[0] - 10, mouseCoords[1] - 10);
    ctx.lineTo(mouseCoords[0] + 10, mouseCoords[1] + 10);
    ctx.moveTo(mouseCoords[0] + 10, mouseCoords[1] - 10);
    ctx.lineTo(mouseCoords[0] - 10, mouseCoords[1] + 10);
    ctx.lineWidth = "4";
    ctx.strokeStyle = "#aa0000";
    ctx.stroke();
  }
  ctx.globalAlpha = 1;

  window.requestAnimationFrame(update);
}

var alternatePause = function() {
  if(!paused) {
    paused = true;
    $("#pause").html("Play");
  } else {
    paused = false;
    $("#pause").html("Pause");
  }
}

var addParticle = function(x, y, charge, gravityE) {
  if(fixedParticles) {
    addFixedParticle(x, y, charge);
  } else {
    particles.push(new Particle(particles.length, x, y, 10, charge, 1, gravityE));
  }
}

var addFixedParticle = function(x, y, charge) {
  particles.push(new FixedParticle(particles.length, x, y, 10, charge));
}

var addElectricFields = function() {
  for(var i = 1; i < eFieldDivision; i++) {
    for(var j = 1; j < eFieldDivision; j++) {
      eFields.push(new ElectricField(eFields.length, i/eFieldDivision*cWidth, j/eFieldDivision*cHeight))
    }
  }
}

var addWall = function(x1, y1, x2, y2, charge) {
  walls.push(new Wall(walls.length, x1, y1, x2, y2, 1, 1));
}

function getMousePos(canvas, evt) {
  var rect = canvas.getBoundingClientRect();
  return {
    x: evt.clientX - rect.left,
    y: evt.clientY - rect.top
  };
}

function delegateClick(x, y) {
  if(clickMode === "place") {
    addParticle(x, y, clickCharge, 1);
  } else if(clickMode === "erase") {
    for(var i = 0; i < particles.length; i++) {
      if(particles[i].getDistanceFrom(particles[i].coords, [x, y]) < 40) {
        for(var j = i; j < particles.length; j++) {
          particles[j].id--;
        }
        particles.splice(i, 1);
      }
    }
  }
}



//ui stuff
$(document).ready(function() {
  init();
  $("input[name=fixed]").change(function() {
    fixedParticles = $(this).is(":checked");
  });
  $("input[name=charges]").change(function() {
    clickCharge = $("input[name=charges]:checked").attr("value");
  });
  $("input[name=mode]").change(function() {
    clickMode = $("input[name=mode]:checked").attr("id");
  });
  $("input[name=efield]").change(function() {
    eFieldShown = $(this).is(":checked");
  });
  $("input[name=lines]").change(function() {
    forcesShown = ($(this).is(":checked"));
  });

  $("input[type=range]").change(function() {
    switch($(this).attr("name")) {
      case "eforce":
        eForce = $(this).val()/100;
        break;
      case "gforce":
        gForce = $(this).val()/30;
        break;
      case "fforce":
        fForce = $(this).val()/40;
        break;
    }
  });
  $(document).mousemove(function(event) {
    mouseCoords = [event.pageX - $("#canvas-outer").offset().left, event.pageY - $("#canvas-outer").offset().top];
  });

});
