const Usuario = require("../models/Usuario");
const Producto = require("../models/Producto");
const Cliente = require("../models/Cliente");
const Pedido = require("../models/Pedido");

const bcryptjs = require("bcryptjs");
const jwt = require("jsonwebtoken");
require("dotenv").config({ path: "variables.env" });

const crearToken = (usuario, secreta, expiresIn) => {
  console.log(usuario);
  const { id, email, nombre, apellido } = usuario;

  return jwt.sign({ id, email, nombre, apellido }, secreta, { expiresIn });
};

// Resolvers
const resolvers = {
  Query: {
    obtenerUsuario: async (_, { token }) => {
      const usuarioId = await jwt.verify(token, process.env.SECRETA);

      return usuarioId;
    },
    obtenerProductos: async () => {
      try {
        const productos = await Producto.find({});
        return productos;
      } catch (error) {
        console.log(error);
      }
    },
    obtenerProducto: async (_, { id }) => {
      // Revisar si el producto existe o no
      const producto = await Producto.findById(id);

      if (!producto) {
        throw new Error("Producto no encontrado");
      }

      return producto;
    },
    obtenerClientes: async () => {
      try {
        const clientes = await Cliente.find({});
        return clientes;
      } catch (error) {
        console.log(error);
      }
    },
    obtenerClientesVendedor: async (_, {}, ctx) => {
      try {
        const clientes = await Cliente.find({
          vendedor: ctx.usuario.id.toString(),
        });
        return clientes;
      } catch (error) {
        console.log(error);
      }
    },
    obtenerCliente: async (_, { id }, ctx) => {
      // Revisar si el cliente existe o no
      const cliente = await Cliente.findById(id);

      if (!cliente) {
        throw new Error("Cliente no encontrado");
      }

      // Quien lo creo puede verlo
      if (cliente.vendedor.toString() !== ctx.usuario.id) {
        throw new Error("No tienes las credenciales");
      }

      return cliente;
    },
    obtenerPedidos: async () => {
      try {
        const pedidos = await Pedido.find({});
        return pedidos;
      } catch (error) {
        console.log(error);
      }
    },
  },
  Mutation: {
    nuevoUsuario: async (_, { input }) => {
      const { email, password } = input;

      // Revisar el el usuario ya esta registrado
      const existeUsuario = await Usuario.findOne({ email });
      if (existeUsuario) {
        throw new Error("El usuario ya esta registrado");
      }

      // Hashear su password
      const salt = bcryptjs.genSaltSync(10);
      input.password = bcryptjs.hashSync(password, salt);

      try {
        // Guardarlo en la base de datos
        const usuario = new Usuario(input);
        usuario.save(); // guardarlo
        return usuario;
      } catch (error) {
        console.log(error);
      }
    },
    autenticarUsuario: async (_, { input }) => {
      const { email, password } = input;

      // Si el usaurio existe
      const existeUsuario = await Usuario.findOne({ email });
      if (!existeUsuario) {
        throw new Error("El usuario no esta registrado");
      }

      // Revisar si el password es correcto
      const passwordCorrecto = await bcryptjs.compare(
        password,
        existeUsuario.password
      );
      if (!passwordCorrecto) {
        throw new Error("El password es incorrecto");
      }

      // Crear el token
      return {
        token: crearToken(existeUsuario, process.env.SECRETA, "24h"),
      };
    },
    nuevoProducto: async (_, { input }) => {
      try {
        const producto = new Producto(input);

        // Almacenar en la db
        const resultado = await producto.save();

        return resultado;
      } catch (error) {
        console.log(error);
      }
    },
    actualizarProducto: async (_, { id, input }) => {
      // Revisar si el producto existe o no
      let producto = await Producto.findById(id);

      if (!producto) {
        throw new Error("Producto no encontrado");
      }

      // Guardarlo en la base de datos
      producto = await Producto.findOneAndUpdate({ _id: id }, input, {
        new: true,
      });

      return producto;
    },
    eliminarProducto: async (_, { id }) => {
      // Revisar si el producto existe o no
      let producto = await Producto.findById(id);

      if (!producto) {
        throw new Error("Producto no encontrado");
      }

      // Eliminar
      await Producto.findOneAndDelete({ _id: id });

      return "Producto Eliminado";
    },
    nuevoCliente: async (_, { input }, ctx) => {
      console.log(ctx);

      const { email } = input;
      // Verificar si el cliente ya esta registrado
      console.log(input);

      const cliente = await Cliente.findOne({ email });
      if (cliente) {
        throw new Error("Ese cliente ya esta registrado");
      }

      const nuevoCliente = new Cliente(input);

      // Asignar el vendedor
      nuevoCliente.vendedor = "630ed0829972fc60fd1be4b0";

      // Guardarlo en la db
      try {
        const resultado = await nuevoCliente.save();
        return resultado;
      } catch (error) {
        console.log(error);
      }
    },
    actualizarCliente: async (_, { id, input }, ctx) => {
      // Verificar si existe o no
      let cliente = await Cliente.findById(id);

      if (!cliente) {
        throw new Error("Ese cliente no existe");
      }

      // Verificar si el vendedor es quien edita
      if (cliente.vendedor.toString() !== ctx.usuario.id) {
        throw new Error("No tienes las credenciales");
      }

      // Guardar el cliente
      cliente = await Cliente.findOneAndUpdate({ _id: id }, input, {
        new: true,
      });
      return cliente;
    },
    eliminarCliente: async (_, { id }, ctx) => {
      // Verificar si existe o no
      let cliente = await Cliente.findById(id);

      if (!cliente) {
        throw new Error("Ese cliente no existe");
      }

      // Verificar si el vendedor es quien elimina
      if (cliente.vendedor.toString() !== ctx.usuario.id) {
        throw new Error("No tienes las credenciales");
      }

      // Eliminar Cliente
      await Cliente.findOneAndDelete({ _id: id });
      return "Cliente eliminado";
    },
    nuevoPedido: async (_, { input }, ctx) => {
      const { cliente } = input;

      // Verificar si el cliente existe o no
      let clienteExiste = await Cliente.findById(cliente);

      if (!clienteExiste) {
        throw new Error("Ese cliente no existe");
      }

      // Verificar si el cliente es del vendedor
      if (clienteExiste.vendedor.toString() !== ctx.usuario.id) {
        throw new Error("No tienes las credenciales");
      }

      // Revisar que el stock este disponible
      for await (const articulo of input.pedido) {
        const { id } = articulo;

        const producto = await Producto.findById(id);

        if (articulo.cantidad > producto.existencia) {
          throw new Error(
            `El articulo: ${producto.nombre} excede la cantidad disponible`
          );
        } else {
          // Restar la cantidad a lo disponible
          producto.existencia = producto.existencia - articulo.cantidad;

          await producto.save();
        }
      }

      // Crear un nuevo pedido
      const nuevoPedido = new Pedido(input);

      // Asignarle un vendedor
      nuevoPedido.vendedor = ctx.usuario.id;

      // Guardar en la base de datos
      const resultado = await nuevoPedido.save();
      return resultado;
    },
  },
};

module.exports = resolvers;
