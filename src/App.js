import React, { useState, useEffect } from "react";
import "./App.css";
import "@aws-amplify/ui-react/styles.css";
import { generateClient } from "aws-amplify/api";
import { getProperties } from "aws-amplify/storage";
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
} from "./graphql/mutations";

const client = generateClient();

const Storage = getProperties();

const App = ({ signOut }) => {
  const [notes, setNotes] = useState([]);

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

      // Vérification si le nom et la description sont présents
      const name = form.get("name");
      const description = form.get("description");
      if (!name || !description) {
        return;
      }

      const data = {
        name: name,
        description: description,
        image: image ? image.name : "", // Vérification de l'image
      };

      console.log(data);

      // Gestion du stockage de l'image
      try {
        const result = await Storage(data.name, image);
        data.image = result.key;
      } catch (error) {}

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
            onSubmit={createTodo}
            style={{
              marginBottom: "20px",
              textAlign: "center",
            }}
          >
            <Flex style={{ display: "flex", justifyContent: "center", marginBottom: "24px" }}>
              <TextField
                name="name"
                placeholder="Note Name"
                required
                style={{ textAlign: "start" }}
              />
              <TextField
                name="description"
                placeholder="Note Description"
                required
                style={{ textAlign: "start" }}
              />
              <TextField name="image" placeholder="" type="file" />
            </Flex>
            <Button type="submit" variation="primary" padding={"12px 24px"}>
                Create Note
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

      <Button onClick={signOut} style={{ marginTop: "24px" }} variation="primary" padding={"12px 24px"}>
        Sign Out
      </Button>
    </View>
  );
};

export default withAuthenticator(App);
