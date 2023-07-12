import React, { useEffect, useState } from 'react';

import Container from 'react-bootstrap/Container';
import Row from 'react-bootstrap/Row';
import Col from 'react-bootstrap/Col';
import Nav from 'react-bootstrap/Nav';
import Navbar from 'react-bootstrap/Navbar';
import Offcanvas from 'react-bootstrap/Offcanvas';

// import the logo
import logo from '../aorai.svg';





function Header() {

    const [sectors, setSectors] = useState([]);

    useEffect(() => {


    }, []);

    return (
        <Navbar expand="lg">
            <Container>
                <Navbar.Brand href="https://www.africanobservatory.ai/" target="_blank">
                    <img src={logo} style={{maxWidth: '200px'}}/>
                </Navbar.Brand>
                
                <Navbar.Toggle  />
                <Navbar.Offcanvas placement="end">
                    <Offcanvas.Header closeButton></Offcanvas.Header>
                    <Offcanvas.Body>
                        <Nav className="justify-content-end flex-grow-1">
                            <Nav.Link href="https://www.africanobservatory.ai/about">About</Nav.Link>
                            <Nav.Link href="https://www.africanobservatory.ai/resources">Resources</Nav.Link>
                            <Nav.Link href="https://www.africanobservatory.ai/projects">Projects</Nav.Link>
                            <Nav.Link href="https://www.africanobservatory.ai/social">Social</Nav.Link>
                            <Nav.Link href="https://www.africanobservatory.ai/women-in-focus">Women in focus</Nav.Link>
                        </Nav>
                    </Offcanvas.Body>
                </Navbar.Offcanvas>
                
                {/* <Nav className="me-auto">
                    <Nav.Link href="https://www.africanobservatory.ai/about">About</Nav.Link>
                    <Nav.Link href="https://www.africanobservatory.ai/resources">Resources</Nav.Link>
                    <Nav.Link href="https://www.africanobservatory.ai/projects">Projects</Nav.Link>
                    <Nav.Link href="https://www.africanobservatory.ai/social">Social</Nav.Link>
                    <Nav.Link href="https://www.africanobservatory.ai/women-in-focus">Women in focus</Nav.Link>
                </Nav> */}
            </Container>
        </Navbar>
    )

}

export default Header;