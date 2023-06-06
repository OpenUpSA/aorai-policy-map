import React, { useEffect, useState } from 'react';
import ReactDOMServer from 'react-dom/server';

import axios from 'axios';

import { Icon } from '@mdi/react';
import { mdiFilterOutline, mdiCogOutline, mdiInformationSlabCircle } from '@mdi/js';

import { Card, Container, Row, Col, Accordion, Button, Form, Popover, OverlayTrigger } from 'react-bootstrap';
import Spinner from 'react-bootstrap/Spinner';

import { Animate, AnimateKeyframes, AnimateGroup } from "react-simple-animate";

import { MultiSelect } from 'react-multi-select-component';

import { MapContainer, GeoJSON, LayerGroup, Marker, Popup } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';

import getCountryISO2 from 'country-iso-3-to-2';
import ReactCountryFlag from 'react-country-flag';

import * as allCountries from '../data/countries.geo.json';
import * as africanCountries from '../data/african-countries.json';
import * as centroids from '../data/centroids.geo.json';

import BarChart from './BarChart';
import countryIso3To2 from 'country-iso-3-to-2';
import { filter, geoConicEquidistantRaw } from 'd3';



function Map() {
    const api = {
        base_url: 'https://nocodb.openup.org.za/api/v1/db/data/v1/AORAI'
    }
    const [loading, setLoading] = useState(true);
    const [loadingText, setLoadingText] = useState('Loading...');
    const [position, setPosition] = useState([-7, 22]);
    const [policyAreas, setPolicyAreas] = useState([]);
    const [selectedPolicyAreas, setSelectedPolicyAreas] = useState([]);
    const [selectedCountries, setSelectedCountries] = useState([]);
    const [selectedYears, setSelectedYears] = useState([1960,2023]);
    const [activePolicyAreas, setActivePolicyAreas] = useState([]);
    const [filteredData, setFilteredData] = useState([]);
    const [policies, setPolicies] = useState([]);
    const [refreshMap, setRefreshMap] = useState(1);
    const [showSection, setShowSection] = useState('map');

    useEffect(() => {

        getPolicies();
        getPolicyAreas();
        
    }, []);

    const getPolicies = () => {

        let countryWhere = '';
        let policyAreaWhere = '';

        let yearsArray = [];
        for (let year = selectedYears[0]; year <= selectedYears[1]; year++) {
            yearsArray.push(year);
        }
        
        let dateWhere = '(Year,in,' + yearsArray.join(',') + ')';

        if(selectedCountries.length) {
            countryWhere = '(Country,in,' + selectedCountries.join(',') + ')';
        }
        if (selectedPolicyAreas.length) {
            policyAreaWhere = '((Observatory AI policy areas - primary,in,' + selectedPolicyAreas.join(',') + ')~or(Observatory AI policy areas - secondary,in,' + selectedPolicyAreas.join(',') + '))';
        }

        let where = '';
        if (countryWhere != '' && policyAreaWhere != '') {
            where = dateWhere + '~and(Country,isnot,null)~and' + countryWhere + '~and' + policyAreaWhere;
        } else if (countryWhere == '' && policyAreaWhere == '') {
            where = dateWhere + '~and(Country,isnot,null)';
        } else {
            where = dateWhere + '~and(Country,isnot,null)~and' + countryWhere + policyAreaWhere;
        }

        console.log(where);


        axios.get(api.base_url + '/Policy and Governance Map', {
            headers: {
                'xc-token': process.env.API_KEY
            },
            params: {
                limit: 150,
                fields: 'Original title,English title,External URL,Country,Year,Analysis status,Observatory AI policy areas - primary,Observatory AI policy areas - secondary',
                'nested[Country][fields]': 'Country name,Country code',
                where: where,
                // where: '(Analysis status,eq,Publish to website)~and(Country,isnot,null)',
            }
        }).then(function(response) {

            let queries = [];

            for (let count = 0; count < Math.ceil(response.data.pageInfo.totalRows / 150); count++) {
                let offset = count > 0 ? '?offset=' + (count * 150) : '';
                queries.push(api.base_url + '/Policy and Governance Map' + offset);
            }

            let queries_get = [];

            for (let query = 0; query < queries.length; query++) {
                
                queries_get.push(axios.get(queries[query], { 
                    headers: {
                        'xc-token': process.env.API_KEY
                    },
                    params: {
                        limit: 150,
                        fields: 'Original title,English title,External URL,Country,Year,Analysis status,Observatory AI policy areas - primary,Observatory AI policy areas - secondary',
                        'nested[Country][fields]': 'Country name,Country code',
                        where: where,
                        // where: '(Analysis status,eq,Publish to website)~and(Country,isnot,null)',
                    }
                }))

            }

            axios.all(queries_get).then(axios.spread((...responses) => {

                let policiesData = [];

                for (let count = 0; count < responses.length; count++) {
                    let response = responses[count];
                    policiesData = policiesData.concat(response.data.list);
                }

                let policiesDataTransformed = policiesData.reduce((r, a) => {
                    r[a.Country[0]['Country code']] = [...r[a.Country[0]['Country code']] || [], a];
                    return r;
                }, {});

                // Add keys for missing countries
                for (let count = 0; count < africanCountries.length; count++) {
                    let country = africanCountries[count];
                    if (!policiesDataTransformed[country.iso_code]) {
                        policiesDataTransformed[country.iso_code] = [];
                    }
                }


                setFilteredData(policiesDataTransformed);
                setLoading(false);

                
            })).catch(error => {
                console.log(error);
            })

        })


    }

    const getPolicyAreas = () => {

        // Get POLICY AREAS data
        axios.get(api.base_url + '/Observatory AI policy areas', {
            headers: {
                'xc-token': process.env.API_KEY
            }
        }).then(function(response) {
            setPolicyAreas(response.data.list);
        })
    
    }

    useEffect(() => {

        getPolicies();

    }, [selectedPolicyAreas, selectedCountries, selectedYears]);


    const getPolicyCount = (iso_code) => {

        if(filteredData[iso_code]) {
            return filteredData[iso_code].length;
        } else {
            return '-';
        }

    }

    const selectPolicyArea = (e) => {

        let policy = e.target.value;
        let checked = e.target.checked;

        if (checked) {
            setSelectedPolicyAreas([...selectedPolicyAreas, policy]);
        } else {
            setSelectedPolicyAreas(selectedPolicyAreas.filter((item) => item !== policy));
        }
    }

    const selectCountry = (e) => {

        let country = e.target.value;
        let checked = e.target.checked;

        if (checked) {
            setSelectedCountries([...selectedCountries, country]);
        } else {
            setSelectedCountries(selectedCountries.filter((item) => item !== country));
        }

    }

    const selectYear = (e, startEnd) => {
        
        let year = e.target.value;

        if (startEnd == 'start') {
            setSelectedYears([year, selectedYears[1]]);
        } else {
            if(year < selectedYears[0]) {
                setSelectedYears([year,selectedYears[0]]);
            } else {
                setSelectedYears([selectedYears[0],year]);
            }
        }

    }

    const transformFilteredData = () => {

        let policiesData = [];

        Object.keys(filteredData).forEach( key => {

            if(filteredData[key].length) {
                policiesData.push(filteredData[key]);
            }

        })

        policiesData = policiesData.flat();

        setPolicies(policiesData);
        updateBarChart();
    
    }


    const itemsCount = (data) => {
        
        let policyCount = 0;

        Object.keys(data).forEach(key=>{
            policyCount += data[key].length;
        })

        return policyCount;

    }

    const toggleAllPolicyAreas = (e) => {

        let checked = e.target.checked;

        if (checked) {
            setSelectedPolicyAreas(policyAreas);
        } else {
            setSelectedPolicyAreas([]);
        }

    }


    const updateTooltips = () => {

        Object.keys(filteredData).forEach(key=>{
            let tooltip = document.getElementById('iso-' + key);
            if (tooltip) {
                tooltip.innerHTML = getPolicyCount(key);
            }
        })

        setRefreshMap(refreshMap + 1);
    }


    useEffect(() => {

        transformFilteredData();
        updateTooltips();
        
    

    }, [filteredData]);


    const updateBarChart = () => {

        let activePolicyAreas = [];

        if(selectedPolicyAreas.length) {

            // Add all selectedPolicyAreas to the array
            selectedPolicyAreas.forEach((selectedPolicyArea) => {
                activePolicyAreas.push({
                    policy_area: selectedPolicyArea,
                    count: 0
                });
            });

            Object.keys(filteredData).forEach((key)=>{
                filteredData[key].forEach((policy)=>{
                    policy.policyAreas = policy['Observatory AI policy areas - primary'].concat(policy['Observatory AI policy areas - secondary']);
                    policy.policyAreas.forEach((policyArea)=>{
                        activePolicyAreas.forEach((activePolicyArea)=>{
                            if (activePolicyArea.policy_area == policyArea['Policy area']) {
                                activePolicyArea.count++;
                            }
                        });
                    });
                });
            });

            setActivePolicyAreas(activePolicyAreas);
        
        } else {
            setActivePolicyAreas([]);
        }

    }

    const style = (feature) => {

        const scale = (value) => {
            
            return value < 1 ? '#dfdfdf' :
            value > 0 && value < 11 ? '#dee2e1' :
            value > 10 && value < 21 ? '#bfd4d3' :
            value > 20 && value < 41 ? '#80aaa8' : 
            value > 41 ? '#3c7a77' : '#dfdfdf';

        }

        return {
            fillColor: africanCountries.map(country => country.iso_code).includes(feature.id) ? scale(getPolicyCount(feature.id)) : '#e3e7e5',
            weight: 0.5,
            opacity: 1,
            color: '#fff',
            dashArray: '0',
            fillOpacity: 1,
        };

    }

    const onEachFeature = (feature, layer) => {
        if (feature) {

            if (africanCountries.map(country => country.iso_code).includes(feature.id)) {
                layer.bindTooltip(`<div class="country-tooltip"><div class="iso-code">${getCountryISO2(feature.id)}</div><div class="policy-count" id="iso-${feature.id}">${getPolicyCount(feature.id)}</div></div>`, { permanent: true, direction: "center" });
            }

            let popupContent = ReactDOMServer.renderToString(
                <>
                    <div style={{width: '1.4em', height: '1.4em', borderRadius: '50%', overflow: 'hidden', position: 'relative', display: 'inline-block', top: '5px', backgroundColor: '#ccc'}} className="border">
                        <ReactCountryFlag 
                            countryCode={getCountryISO2(feature.id)}
                            svg
                            style={{
                                position: 'absolute', 
                                top: '30%',
                                left: '30%',
                                marginTop: '-50%',
                                marginLeft: '-50%',
                                fontSize: '1.8em',
                                lineHeight: '1.8em',
                            }} 
                        />
                        </div>{feature.properties.name}
                        {getPolicyCount(feature.id)}
                        <BarChart data={activePolicyAreas} chartid={feature.id}/>

                </>
            );

            layer.bindPopup(popupContent);

        }

        layer.on({
            click: (e) => {
                let layer = e.target;
                layer.setStyle({
                    fillOpacity: 0.6,
                });
                layer.bringToFront();
                layer.openPopup();
                

            }
        });

        layer.on({
            mouseover: (e) => {
                let layer = e.target;
                layer.setStyle({
                    fillOpacity: 0.6,
                });
            }
        });

        layer.on({
            mouseout: (e) => {
                let layer = e.target;
                layer.setStyle({
                    fillOpacity: 1,
                });
            }
        });


    }

    





    return (
        
        loading ?

            <div className="position-absolute top-50 start-50 translate-middle text-center">
                <Spinner animation="grow" /><br/>
                <span className="text-uppercase fs-5 fw-bold">{loadingText}</span>
            </div>
        
        :
        
        <div className="policy-map position-relative">
            <AnimateGroup play>
                {
                    showSection == 'map' &&
                        <MapContainer
                            className="map-container"
                            center={position}
                            zoom={4}
                            scrollWheelZoom={false}
                            zoomControl={false}

                        >
                            <LayerGroup>
                                <GeoJSON data={allCountries} style={style} onEachFeature={onEachFeature} refresh={refreshMap}/>
                            </LayerGroup>
                        </MapContainer>
                }
                
                <Container fluid className="controls-overlay py-2 pe-none">
                    <Row className="pe-none">
                        <Col md={3} className="pe-auto">

                            {/* FILTERS */}
                            <Animate start={{ opacity: 0, filter: 'blur(10px)' }} end={{ opacity: 1, filter: 'blur(0)' }} sequenceIndex={1}>
                                <Card className="shadow-sm border-0 rounded sticky-top">
                                    <Card.Header>
                                        <Icon path={mdiFilterOutline} size={1} /> <span>FILTERS</span>
                                    </Card.Header>
                                    <Card.Body className="p-0">
                                        <Accordion defaultActiveKey="0" flush>
                                            <Accordion.Item eventKey="0">
                                                <Accordion.Header>POLICY AREAS</Accordion.Header>
                                                <Accordion.Body className="px-2">
                                                    <div className="scrollarea" style={{ height: '250px' }}>
                                                        {/* <Row className="mb-2 p-1 list-item-bg">
                                                            <Col>
                                                                <label>All</label>
                                                            </Col>
                                                            <Col xs="auto">
                                                                <input type="checkbox" value="all" onChange={toggleAllPolicyAreas}/>
                                                            </Col>
                                                        </Row> */}
                                                        {
                                                            policyAreas.map((policy_area, index) => {
                                                                return (
                                                                    <Row key={index} className="mb-2 p-1 list-item-bg">
                                                                        <Col>
                                                                            <label>{policy_area['Policy area']}</label>
                                                                        </Col>
                                                                        <Col xs="auto">
                                                                            <input type="checkbox" value={policy_area['Policy area']} onChange={selectPolicyArea} checked={selectedPolicyAreas.includes(policy_area['Policy area'])} />
                                                                        </Col>
                                                                    </Row>
                                                                )
                                                            })
                                                        }
                                                    </div>
                                                </Accordion.Body>
                                            </Accordion.Item>
                                            <Accordion.Item eventKey="1">
                                                <Accordion.Header>COUNTRIES</Accordion.Header>
                                                <Accordion.Body className="px-2">
                                                    <div className="scrollarea" style={{ height: '250px' }}>
                                                        {
                                                            allCountries.features.map((country, index) => {
                                                                if(africanCountries.map(cntry => cntry.iso_code).includes(country.id)) {
                                                                    return (
                                                                        <Row key={index} className="mb-2 p-1 list-item-bg">
                                                                            <Col>
                                                                                <label>
                                                                                    <div style={{width: '1.4em', height: '1.4em', borderRadius: '50%', overflow: 'hidden', position: 'relative', display: 'inline-block', top: '5px', backgroundColor: '#ccc'}} className="border">
                                                                                        <ReactCountryFlag 
                                                                                            countryCode={getCountryISO2(country.id)}
                                                                                            svg
                                                                                            style={{
                                                                                                position: 'absolute', 
                                                                                                top: '30%',
                                                                                                left: '30%',
                                                                                                marginTop: '-50%',
                                                                                                marginLeft: '-50%',
                                                                                                fontSize: '1.8em',
                                                                                                lineHeight: '1.8em',
                                                                                            }} 
                                                                                        />
                                                                                    </div>&nbsp;&nbsp;{country.properties.name}
                                                                                </label>
                                                                            </Col>
                                                                            <Col xs="auto">
                                                                                <input type="checkbox" value={country.properties.name} onChange={selectCountry} />
                                                                            </Col>
                                                                        </Row>
                                                                    )
                                                                }
                                                            })
                                                        }
                                                    </div>
                                                </Accordion.Body>
                                            </Accordion.Item>
                                            <Accordion.Item eventKey="2">
                                                <Accordion.Header>DATE SETTINGS</Accordion.Header>
                                                <Accordion.Body className="px-2">
                                                    <Row>
                                                        <Col xs="auto" className="d-flex align-items-center fw-bold">Period:</Col>
                                                        <Col className="pe-0">
                                                            <Form.Select className="bg-control-grey" size="sm" onChange={ e => selectYear(e, 'start')}>
                                                            {
                                                                // Option for dates between 1960 and 2023
                                                                Array.from({ length: 2023 - 1960 + 1 }, (_, i) => i + 1960).map((year) => {
                                                                    return (
                                                                        <option key={year} value={year} selected={year == selectedYears[0] ? 'selected' : ''}>{year}</option>
                                                                    )
                                                                })

                                                            }
                                                            </Form.Select>
                                                        </Col>
                                                        <Col xs="auto" className="d-flex align-items-center px-2">
                                                            TO
                                                        </Col>
                                                        <Col className="ps-0">
                                                            <Form.Select className="bg-control-grey" size="sm" onChange={ e => selectYear(e, 'end')}>
                                                            {
                                                                // Option for dates between 1960 and 2023
                                                                Array.from({ length: 2023 - 1960 + 1 }, (_, i) => i + 1960).map((year) => {
                                                                    return (
                                                                        <option key={year} value={year} selected={year == selectedYears[1] ? 'selected' : ''}>{year}</option>
                                                                    )
                                                                })

                                                            }
                                                            </Form.Select>
                                                        </Col>
                                                    </Row>
                                                </Accordion.Body>
                                            </Accordion.Item>
                                        </Accordion>
                                    </Card.Body>
                                </Card>
                            </Animate>

                            {/* SETTINGS */}
                            {/* <Animate start={{ opacity: 0, filter: 'blur(10px)' }} end={{ opacity: 1, filter: 'blur(0)' }} sequenceIndex={2}>
                                <Card className="mt-3 shadow-sm border-0 rounded">
                                    <Card.Body className="py-0">
                                        <Accordion defaultActiveKey="0" flush>
                                            <Accordion.Item eventKey="0">
                                                <Accordion.Header>
                                                    <Icon path={mdiCogOutline} size={1} /> <div>SETTINGS</div>
                                                </Accordion.Header>
                                                <Accordion.Body className="px-0">
                                                    
                                                </Accordion.Body>
                                            </Accordion.Item>
                                        </Accordion>
                                    </Card.Body>
                                </Card>
                            </Animate> */}

                        </Col>
                        <Col className="pe-none">
                            <Animate start={{ opacity: 0, filter: 'blur(10px)' }} end={{ opacity: 1, filter: 'blur(0)' }} sequenceIndex={0}>
                                <div className="d-flex justify-content-center">
                                    <Card className="shadow-sm border-0 rounded pe-auto">
                                        <Card.Body className="p-2">
                                            <Row>
                                                <Col className="pe-1">
                                                    <Button className="rounded-0 w-100" size="sm" variant={showSection == 'map' ? 'primary' : 'light'} onClick={() => setShowSection('map')}>Map</Button>
                                                </Col>
                                                {/* <Col className="px-1">
                                                    <Button className="rounded-0 w-100" size="sm" variant={showSection == 'list' ? 'primary' : 'light'}onClick={() => setShowSection('list')}>List</Button>
                                                </Col> */}
                                                <Col className="ps-1">
                                                    <Button className="rounded-0 w-100" size="sm" variant={showSection == 'policies' ? 'primary' : 'light'}onClick={() => setShowSection('policies')}>Policies</Button>
                                                </Col>
                                            </Row>
                                        </Card.Body>
                                    </Card>
                                </div>
                            </Animate>

                            {
                                showSection == 'policies' && 
                                    <Row className="mt-2">
                                        <Col>
                                            <div>
                                                {
                                                    policies.map((item, index) => {
                                                            return (
                                                                <div className="mb-2" key={index}>
                                                                    <Card className="policies-list-item shadow-sm border-0 rounded data-card pe-auto">
                                                                        <Card.Body>
                                                                            <Row key={index} className="mb-2">
                                                                                <Col>
                                                                                    <h4><a href={item['External URL']} target="_blank">{item['English title'] ? item['English title'] : item['Original title']}</a></h4>
                                                                                </Col>
                                                                                <Col xs="auto" className="d-flex align-items-center fw-bold">
                                                                                    {
                                                                                        (item.Year.map((year, index) => 
                                                                                            <span key={index}>{year.Year}</span>
                                                                                        ))
                                                                                    }
                                                                                </Col>
                                                                            </Row>
                                                                        </Card.Body>
                                                                        <Card.Footer>
                                                                            <Row>
                                                                                <Col>
                                                                                    {
                                                                                        item['Country'].map((country, index) => {
                                                                                            return (
                                                                                                <div key={index} className="policy-country-label">
                                                                                                    <div style={{width: '1.4em', height: '1.4em', borderRadius: '50%', overflow: 'hidden', position: 'relative', display: 'inline-block', top: '5px', backgroundColor: '#ccc'}} className="border">
                                                                                                        <ReactCountryFlag 
                                                                                                            countryCode={getCountryISO2(country['Country code'])}
                                                                                                            svg
                                                                                                            style={{
                                                                                                                position: 'absolute', 
                                                                                                                top: '30%',
                                                                                                                left: '30%',
                                                                                                                marginTop: '-50%',
                                                                                                                marginLeft: '-50%',
                                                                                                                fontSize: '1.8em',
                                                                                                                lineHeight: '1.8em',
                                                                                                            }} 
                                                                                                        />
                                                                                                    </div>&nbsp;&nbsp;{country['Country name']}
                                                                                                </div>
                                                                                            )
                                                                                        })

                                                                                    }  
                                                                                </Col>
                                                                            </Row>
                                                                            <Row>
                                                                                <Col>
                                                                                    {
                                                                                        item['Observatory AI policy areas - primary'].concat(item['Observatory AI policy areas - secondary']).map((policyArea, index) => {
                                                                                            return (
                                                                                                <div className="policy-area-label">
                                                                                                { policyArea['Policy area'] }
                                                                                                </div>
                                                                                            )
                                                                                        })
                                                                                    }
                                                                                </Col>
                                                                            </Row>
                                                                        </Card.Footer>
                                                                    </Card>
                                                                </div>
                                                            )
                                                        })
                                                    }
                                            </div>
                                        </Col>
                                    </Row>
                            }

                            {/* {
                                showSection == 'list' &&

                                    
                                        


                            } */}
                        
                        </Col>
                        <Col md={3} className="pe-auto">

                            {/* SETTINGS */}
                            <Animate start={{ opacity: 0, filter: 'blur(10px)' }} end={{ opacity: 1, filter: 'blur(0)' }} sequenceIndex={3}>
                                <Card className="shadow-sm border-0 rounded data-card">
                                    <Card.Header>
                                        <Icon path={mdiInformationSlabCircle} size={1} /> <span>DETAILS</span>
                                    </Card.Header>

                                    <Card.Body className="p-0">
                                        <Accordion defaultActiveKey={['0','1']} flush alwaysOpen>
                                            <Accordion.Item eventKey="0">
                                                <Accordion.Header>HIGHLIGHTS</Accordion.Header>
                                                <Accordion.Body className="px-2 fw-bold">
                                                    <Container>

                                                        <Row className="p-1 list-item-bg">
                                                            <Col>AI Law and Policy Items</Col>
                                                            <Col xs="auto">
                                                                {itemsCount(filteredData)}
                                                            </Col>
                                                        </Row>
                                                        <Row className="p-1 mt-2 list-item-bg">
                                                            <Col>
                                                                {selectedPolicyAreas.length > 0 ?
                                                                    <OverlayTrigger placement="left" overlay={
                                                                        <Popover id="popover-basic">
                                                                            <Popover.Header as="h3">Policy Areas</Popover.Header>
                                                                            <Popover.Body>
                                                                            {
                                                                                selectedPolicyAreas.join(', ')
                                                                            }
                                                                            </Popover.Body>
                                                                        </Popover>
                                                                    }>
                                                                        <span>Policy Areas</span>
                                                                    </OverlayTrigger>
                                                                    : 'Policy Areas'
                                                                }
                                                            </Col>
                                                            <Col xs="auto">{selectedPolicyAreas.length ? selectedPolicyAreas.length : 'All'}</Col>
                                                        </Row>
                                                        <Row className="p-1 mt-2 list-item-bg">
                                                            <Col>
                                                                {
                                                                    selectedCountries.length > 0 ?
                                                                    <OverlayTrigger placement="left" overlay={
                                                                        <Popover id="popover-basic">
                                                                            <Popover.Header as="h3">Countries</Popover.Header>
                                                                            <Popover.Body>
                                                                            {
                                                                                selectedCountries.join(', ')
                                                                            }
                                                                            </Popover.Body>
                                                                        </Popover>
                                                                    }>
                                                                        <span>Countries</span>
                                                                    </OverlayTrigger>
                                                                    : 'Countries'
                                                                }
                                                            </Col>
                                                            <Col xs="auto">{selectedCountries.length ? selectedCountries.length : 'All'}</Col>
                                                        </Row>
                                                        <Row className="p-1 mt-2 list-item-bg">
                                                            <Col>Period</Col>
                                                            <Col xs="auto">{selectedYears[0]} - {selectedYears[1]}</Col>
                                                        </Row>
                                                        
                                                    
                                                    </Container>
                                                </Accordion.Body>
                                            </Accordion.Item>
                                            <Accordion.Item eventKey="1">
                                                <Accordion.Header>AI POLICY AREAS</Accordion.Header>
                                                <Accordion.Body className="px-2">
                                                    {
                                                        activePolicyAreas.length > 0 ?
                                                        <BarChart data={activePolicyAreas} chartid={'all'}/>
                                                        : <div className="p-1 text-center no-policies fw-bold">No Policy Areas Selected</div>
                                                    }
                                                </Accordion.Body>
                                            </Accordion.Item>
                                            {/* <Accordion.Item eventKey="2">
                                                <Accordion.Header>PUBLISHING TIMELINE</Accordion.Header>
                                                <Accordion.Body className="px-0">
                                                </Accordion.Body>
                                            </Accordion.Item> */}
                                        </Accordion>
                                    </Card.Body>
                                </Card>
                            </Animate>

                        
                        </Col>



                    </Row>
                </Container>
                    

               
               
            </AnimateGroup>
        </div>
    );
}

export default Map;