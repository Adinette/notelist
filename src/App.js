import React, { useState, useEffect } from "react";
import "./App.css";
import "@aws-amplify/ui-react/styles.css";
import { generateClient } from "aws-amplify/api";
import {
  Button,
  Flex,
  Heading,
  View,
  withAuthenticator,
  Table,
  TableRow,
  TableCell,
  TableHead,
  TableBody,
  TextField,
} from "@aws-amplify/ui-react";
import { listTodos } from "./graphql/queries";
import {
  createTodo as createTodoMutation,
  deleteTodo as deleteTodoMutation,
  updateTodo as updateTodoMutation,
} from "./graphql/mutations";
import { getProperties } from "aws-amplify/storage";

const client = generateClient();

const Storage = getProperties();

const App = ({ signOut }) => {
  const [notes, setNotes] = useState([]);
  const [editNotes , setEditNotes]= useState([]);

  // Fonction pour récupérer les notes
  async function fetchNotes() {
    try {
      // Récupération des notes depuis l'API
      const apiData = await client.graphql({ query: listTodos });
      console.log("Notes :", apiData);

      if (!apiData || !apiData.data || !apiData.data.listTodos) {
        console.error(
          "Les données reçues de l'API ne sont pas valides :",
          apiData
        );
        return;
      }
      const notesFromAPI = apiData.data.listTodos.items || [];
      console.log("Notes reçues de l'API :", notesFromAPI);

      const fetchImageUrl = async (note) => {
        if (note.image) {
          try {
            const url = await Storage(note.image);
            return { ...note, image: url };
          } catch (error) {}
        }
        return note;
      };

      // Récupération des images pour toutes les notes
      const notesWithImages = await Promise.all(
        notesFromAPI.map(fetchImageUrl)
      );

      // Mise à jour de l'état avec les notes complètes
      setNotes(notesWithImages);
    } catch (error) {
      console.error(error);
    }
  }

  async function createTodo(event) {
    event.preventDefault();
    try {
      const form = new FormData(event.target);
      const image = form.get("image");
      const name = form.get("name");
      const description = form.get("description");

      if (!name || !description) {
        return;
      }

      const data = {
        name: name,
        description: description,
        image: image.name,
      };
      console.log(data);

      // Gestion du stockage de l'image
      if (image) {
        try {
          // Utilisation de Storage.put() pour uploader l'image dans S3
          const result = await getProperties(data.name, image, {
            path: "notes", // Assurez-vous de définir le type de contenu correct (ex: 'image/png')
          });
        console.log("Image uploadée avec succès :", result);

        // Utilisation de Storage.get() pour récupérer l'URL publique de l'image stockée
        const imageUrl = await Storage.get(result.key);
        console.log("URL de l'image récupérée :", imageUrl);

        data.image = imageUrl; // Stocker l'URL publique de l'image dans les données
        // const result = await Storage(data.name, image);
        // console.log(result);
        // data.image = result.key;
      } catch (error) {}
    }
      // Appel à l'API GraphQL pour créer la note
      const response = await client.graphql({
        query: createTodoMutation,
        variables: {
          input: data,
        },
      });

      console.log(response);

      // Rafraîchissement de la liste des notes
      fetchNotes();
      event.target.reset();
    } catch (error) {
      console.error(error);
    }
  }

  // Utilisation de useEffect pour récupérer les notes au chargement du composant

  useEffect(() => {
    fetchNotes();
  }, []);

  async function updateTodo(event) {
    event.preventDefault();
  
    const form = new FormData(event.target);
    const updatedName = form.get("name");
    const updatedDescription = form.get("description");
    const updatedImage = form.get("image");
  
    if (!updatedName || !updatedDescription) {
      console.error("Le nom et la description sont obligatoires.");
      return;
    }
  
    const updatedData = {
      id: editNotes.id, // Utiliser l'ID de la note en cours d'édition
      name: updatedName,
      description: updatedDescription,
    };
  
    if (updatedImage && updatedImage.name) {
      try {
        const result = await Storage.put(`${Date.now()}_${updatedImage.name}`, updatedImage, {
          contentType: updatedImage.type,
          level: "public",
        });
        const imageUrl = await Storage.get(result.key, { level: "public" });
        updatedData.image = imageUrl;
      } catch (error) {
        console.error("Erreur lors de l'upload de l'image :", error);
        return;
      }
    }
  
    try {
      await client.graphql({
        query: updateTodoMutation, // Changez ici pour la mutation update
        variables: {
          input: updatedData,
        },
      });
      fetchNotes(); // Recharge les notes
      setEditNotes(null); // Remet à zéro l'état d'édition
      event.target.reset(); // Réinitialise le formulaire
    } catch (error) {
      console.error("Erreur lors de la mise à jour de la note :", error);
    }
  }
  

  async function deleteTodo({ id, name }) {
    const newNotes = notes.filter((note) => note.id !== id);
    setNotes(newNotes);
    try {
      const result = await Storage(name);
      console.log(result);
    } catch (error) {}
    await client.graphql({
      query: deleteTodoMutation,
      variables: { input: { id } },
    });
  }

  return (
    <View
      className="App"
      style={{
        margin: "0 auto",
        padding: "48px 0",
        backgroundColor: "beige",
      }}
    >
      <div>
        <div style={{ margin: "24px 0" }}>
          <Heading
            level={1}
            style={{
              textAlign: "center",
              marginBottom: "16px",
              fontWeight: 600,
              textDecoration: "underline",
              color: "green",
            }}
          >
            My Notes App
          </Heading>
          <form
            // onSubmit={createTodo}
            onSubmit={editNotes ? updateTodo : createTodo}
            style={{
              marginBottom: "20px",
              textAlign: "center",
            }}
          >
            <Flex
              style={{
                display: "flex",
                justifyContent: "center",
                marginBottom: "24px",
              }}
            >
              <TextField
                name="name"
                placeholder="Note Name"
                defaultValue={editNotes ? editNotes.name : ""} // Pré-rempli si en édition
                required
                style={{ textAlign: "start" }}
              />
              <TextField
                name="description"
                placeholder="Note Description"
                defaultValue={editNotes ? editNotes.description : ""} // Pré-rempli si en édition
                required
                style={{ textAlign: "start" }}
              />
              <TextField name="image" placeholder="" type="file" />
            </Flex>
            {/* <Button type="submit" variation="primary" padding={"12px 24px"}>
              Create Note
            </Button> */}
            <Button type="submit" variation="primary" padding={"12px 24px"}>
    {editNotes ? "Update Note" : "Create Note"} {/* Change le texte du bouton */}
  </Button>
          </form>
        </div>

        <div>
          <Heading
            level={2}
            style={{
              fontWeight: 600,
              textDecoration: "underline",
              color: "green",
              marginBottom: "24px",
            }}
          >
            Current Notes
          </Heading>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>Name</TableCell>
                <TableCell>Description</TableCell>
                <TableCell>Image</TableCell>
                <TableCell>Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {notes.map((note) => (
                <TableRow key={note.id || note.name}>
                  <TableCell>{note.name}</TableCell>
                  <TableCell>{note.description}</TableCell>
                  <TableCell>
                    {note.image ? (
                      <img
                        src={note.image}
                        alt={note.name}
                        style={{ width: "100px", height: "auto" }}
                      />
                    ) : (
                      <span>Aucune image</span>
                    )}
                  </TableCell>
                  <TableCell>
                  <Button
          variation="link"
          onClick={() => setEditNotes(note)} // Prépare la note pour l'édition
        >
          Edit
        </Button>
                    <Button variation="link" onClick={() => deleteTodo(note)}>
                      Delete
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </div>

      <Button
        onClick={signOut}
        style={{ marginTop: "24px" }}
        variation="primary"
        padding={"12px 24px"}
      >
        Sign Out
      </Button>
    </View>
  );
};

export default withAuthenticator(App);
